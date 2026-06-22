import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

const PANYNJ_HOST = "www.panynj.gov";
const RIDEPATH_PATH = "/bin/portauthority/ridepath.json";

export class RidePathBoardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);

    const webDist = path.join(__dirname, "..", "..", "web", "dist");

    // Private bucket; CloudFront reaches it via Origin Access Control.
    const bucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,   // clean teardown for a personal deploy
      autoDeleteObjects: true,
    });

    // ~20s cache for the PATH feed: live enough, but spares Port Authority.
    const apiCache = new cloudfront.CachePolicy(this, "RidePathApiCache", {
      defaultTtl: cdk.Duration.seconds(20),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(30),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        // Same-origin proxy to the PATH feed => no CORS in the browser.
        [RIDEPATH_PATH]: {
          origin: new origins.HttpOrigin(PANYNJ_HOST, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: apiCache,
          // Don't forward the viewer Host; CloudFront sends www.panynj.gov,
          // which is what Port Authority expects.
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true,
        },
      },
    });

    // Upload web/dist and invalidate the cache on every deploy.
    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [s3deploy.Source.asset(webDist)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "SiteURL", {
      value: "https://" + distribution.distributionDomainName,
    });
  }
}
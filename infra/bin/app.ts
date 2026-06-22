#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { RidePathBoardStack } from "../lib/boardStack";

const app = new cdk.App();
new RidePathBoardStack(app, "RidePathBoardStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
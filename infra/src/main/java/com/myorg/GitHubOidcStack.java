package com.myorg;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.iam.OidcProviderNative;
import software.amazon.awscdk.services.iam.PolicyStatement;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.iam.WebIdentityPrincipal;
import software.constructs.Construct;

import java.util.List;
import java.util.Map;

/**
 * Lets GitHub Actions deploy with short-lived credentials (no access keys).
 *
 * Only workflows on the main branch of the given repo can assume the role, and
 * the role can do nothing except assume the CDK bootstrap roles
 * (deploy / file-publishing / lookup), which do the actual work.
 */
public class GitHubOidcStack extends Stack {

    public GitHubOidcStack(final Construct scope, final String id, final StackProps props, final String repo) {
        super(scope, id, props);

        OidcProviderNative github = OidcProviderNative.Builder.create(this, "GitHubOidcProvider")
                .url("https://token.actions.githubusercontent.com")
                .clientIds(List.of("sts.amazonaws.com"))
                .build();

        Role deployRole = Role.Builder.create(this, "GitHubDeployRole")
                .description("Assumed by GitHub Actions (" + repo + ", main) to run cdk deploy")
                .maxSessionDuration(Duration.hours(1))
                .assumedBy(new WebIdentityPrincipal(github.getOidcProviderArn(), Map.of(
                        "StringEquals", Map.of(
                                "token.actions.githubusercontent.com:aud", "sts.amazonaws.com",
                                "token.actions.githubusercontent.com:sub", "repo:" + repo + ":ref:refs/heads/main"))))
                .build();

        deployRole.addToPolicy(PolicyStatement.Builder.create()
                .actions(List.of("sts:AssumeRole", "sts:TagSession"))
                .resources(List.of("arn:aws:iam::" + getAccount() + ":role/cdk-hnb659fds-*"))
                .build());

        CfnOutput.Builder.create(this, "DeployRoleArn")
                .description("Set as the AWS_DEPLOY_ROLE_ARN GitHub Actions variable")
                .value(deployRole.getRoleArn()).build();
    }
}

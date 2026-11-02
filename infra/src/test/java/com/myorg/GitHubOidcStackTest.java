package com.myorg;

import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.assertions.Match;
import software.amazon.awscdk.assertions.Template;

import java.util.List;
import java.util.Map;

class GitHubOidcStackTest {

    private Template synth() {
        App app = new App();
        return Template.fromStack(new GitHubOidcStack(app, "Oidc", StackProps.builder()
                .env(Environment.builder().account("111111111111").region("eu-west-1").build()).build(),
                "owner/repo"));
    }

    @Test
    void onlyMainBranchOfRepoCanAssumeRole() {
        synth().hasResourceProperties("AWS::IAM::Role", Map.of(
                "AssumeRolePolicyDocument", Match.objectLike(Map.of("Statement", List.of(Match.objectLike(Map.of(
                        "Action", "sts:AssumeRoleWithWebIdentity",
                        "Condition", Map.of("StringEquals", Map.of(
                                "token.actions.githubusercontent.com:aud", "sts.amazonaws.com",
                                "token.actions.githubusercontent.com:sub", "repo:owner/repo:ref:refs/heads/main")))))))));
    }

    @Test
    void roleCanOnlyAssumeCdkBootstrapRoles() {
        synth().hasResourceProperties("AWS::IAM::Policy", Map.of(
                "PolicyDocument", Match.objectLike(Map.of("Statement", List.of(Map.of(
                        "Action", List.of("sts:AssumeRole", "sts:TagSession"),
                        "Effect", "Allow",
                        "Resource", "arn:aws:iam::111111111111:role/cdk-hnb659fds-*"))))));
    }
}

aws ecs update-service \
    --cluster $EcsClusterName \
    --service $EcsServiceName \
    --desired-count 1 \
    --profile $AwsProfileName
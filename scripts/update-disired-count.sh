aws ecs update-service \
    --cluster $EcsClusterName \
    --service $EcsServiceName \
    --desired-count 3 \
    --profile $AwsProfileName
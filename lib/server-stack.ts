import * as path from "node:path";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { ContainerImage, CpuArchitecture, FargateTaskDefinition, OperatingSystemFamily } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";

export class ServerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // NOTE: VPCの作成
    const vpc = new Vpc(this, "Vpc", { maxAzs: 2 });

    // NOTE: タスク定義の作成
    const taskDefinition = new FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        runtimePlatform: {
          operatingSystemFamily: OperatingSystemFamily.LINUX,
          cpuArchitecture: CpuArchitecture.ARM64,
        },
      },
    );
    taskDefinition.addContainer("AppContainer", {
      image: ContainerImage.fromAsset(path.resolve(__dirname, "../")),
      portMappings: [{
        containerPort: 80,
        hostPort: 80,
      }],
    });

    // NOTE: Fargate起動タイプでサービスの作成
    const fargateService = new ApplicationLoadBalancedFargateService(this, "FargateService", {
      taskDefinition,
      vpc,
    });

    // NOTE: オートスケーリングのターゲット設定
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });
    // NOTE: CPU使用率が50%を超えたらスケールアウト
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });

    // // NOTE: 8時にスケールアウト
    // scaling.scaleOnSchedule("ScaleOutSchedule", {
    //   schedule: applicationAutoscaling.Schedule.cron({ hour: "8", minute: "0" }), // 午前8時
    //   minCapacity: 5,
    // });

    // // NOTE: 18時にスケールイン
    // scaling.scaleOnSchedule("ScaleInSchedule", {
    //   schedule: applicationAutoscaling.Schedule.cron({ hour: "18", minute: "0" }), // 午後6時
    //   minCapacity: 1,
    // });

    // NOTE: 出力としてロードバランサーのDNS名を出力
    new CfnOutput(this, "LoadBalancerDNS", {
      value: fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}

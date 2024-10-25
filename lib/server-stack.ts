import * as path from "node:path";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, Stack, TimeZone } from "aws-cdk-lib";
import { Schedule } from "aws-cdk-lib/aws-applicationautoscaling";
import type { Construct } from "constructs";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { ContainerImage, CpuArchitecture, FargateTaskDefinition, OperatingSystemFamily } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { MetricAggregationType } from "aws-cdk-lib/aws-autoscaling";

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
      maxCapacity: 5,
    });

    // NOTE: CPU使用率に応じてスケールアウト・スケールイン
    scaling.scaleOnMetric("StepScaling", {
      metric: fargateService.service.metricCpuUtilization({
        period: Duration.minutes(1), // 1分間隔でCPU使用率を取得
      }),
      scalingSteps: [
        { lower: 30, change: +1 }, // CPUの使用率が30%以上の場合にタスクを1つ増加
        { upper: 20, change: -1 }, // CPUの使用率が20%以下の場合にタスクを1つ減少
      ],
      metricAggregationType: MetricAggregationType.AVERAGE, // 平均値に基づいてスケーリングされるように設定
      cooldown: Duration.minutes(1), // スケーリングのクールダウン期間を1分に設定
    });

    // NOTE: 8時にスケールアウト
    scaling.scaleOnSchedule("ScaleOutSchedule", {
      timeZone: TimeZone.ASIA_TOKYO,
      schedule: Schedule.cron({ hour: "8", minute: "0" }),
      minCapacity: 3,
    });

    // NOTE: 18時にスケールイン
    scaling.scaleOnSchedule("ScaleInSchedule", {
      timeZone: TimeZone.ASIA_TOKYO,
      schedule: Schedule.cron({ hour: "18", minute: "0" }),
      minCapacity: 1,
    });

    // NOTE: 出力としてロードバランサーのDNS名を出力
    new CfnOutput(this, "LoadBalancerDNS", {
      value: fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}

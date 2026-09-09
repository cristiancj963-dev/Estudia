/**
 * MOTOR DE RESALTADO INTELIGENTE (KEYWORD HIGHLIGHTER)
 * Aplica técnicas de lectura rápida y reconocimiento de patrones.
 * Destaca palabras gatillo clave, requisitos discriminadores y servicios AWS.
 */

const Highlighter = {
  // Palabras clave de requisitos y restricciones críticas (Discriminadores de examen)
  criticalKeywords: [
    "LEAST operational overhead",
    "MOST cost-effectively",
    "MOST cost-effective",
    "HIGHEST performance",
    "LOWEST latency",
    "least operational overhead",
    "most cost-effectively",
    "most cost-effective",
    "highest performance",
    "lowest latency",
    "least possible downtime",
    "minimizes operational complexity",
    "minimizing operational complexity",
    "least privilege",
    "private connectivity",
    "zero downtime",
    "without interruptions",
    "automatically fail over",
    "automatic failover",
    "RTO to less than",
    "RTO less than",
    "RPO",
    "RTO",
    "Choose two",
    "Choose three",
    "Choose four"
  ],

  // Servicios AWS principales para fijación visual
  awsServices: [
    "Amazon Route 53", "Route 53", "inbound resolver", "outbound resolver", "private hosted zone",
    "AWS Transit Gateway", "Transit Gateway", "AWS Direct Connect", "Direct Connect", "AWS PrivateLink", "PrivateLink",
    "Application Load Balancer", "ALB", "Network Load Balancer", "NLB", "AWS Global Accelerator", "Global Accelerator",
    "Amazon Aurora", "Aurora MySQL", "Aurora PostgreSQL", "Aurora Replicas", "Aurora Serverless", "Aurora Global Database",
    "Amazon RDS", "Amazon DynamoDB", "DynamoDB", "ElastiCache for Redis", "Amazon OpenSearch",
    "AWS Lambda", "Amazon ECS", "AWS Fargate", "Fargate", "Amazon EKS", "Amazon ECR",
    "Amazon S3", "S3 Glacier", "S3 Object Lambda", "S3 File Gateway", "Amazon EFS", "Amazon FSx",
    "AWS Organizations", "SCP", "SCPs", "AWS IAM", "IAM Identity Center", "Amazon Cognito", "AWS Secrets Manager", "AWS KMS",
    "AWS Systems Manager", "Systems Manager", "AWS Config", "Amazon EventBridge", "EventBridge", "Amazon SQS", "Amazon SNS",
    "AWS Step Functions", "Step Functions", "AWS Transfer Family", "AWS Storage Gateway", "AWS WAF", "AWS Shield",
    "AWS Database Migration Service", "AWS DMS", "Amazon CloudFront", "CloudFront Functions", "Lambda@Edge"
  ],

  /**
   * Resalta texto con etiquetas HTML y clases de Tailwind CSS sin romper enlaces ni HTML existente
   */
  highlight(text) {
    if (!text) return "";
    let processed = text;

    // 1. Escapar HTML seguro primero
    const div = document.createElement("div");
    div.textContent = text;
    let safe = div.innerHTML;

    // 2. Resaltar Requisitos Críticos (Gatillos principales) en color amarillo / ámbar llamativo
    Highlighter.criticalKeywords.forEach(kw => {
      const reg = new RegExp(`\\b(${kw})\\b`, "gi");
      safe = safe.replace(reg, `<mark class="bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">$1</mark>`);
    });

    // 3. Resaltar Servicios AWS en tono cian / azul técnico
    Highlighter.awsServices.forEach(svc => {
      // Evitar reemplazar si ya está dentro de una etiqueta mark
      const escaped = svc.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const reg = new RegExp(`(?<!<[^>]*)\\b(${escaped})\\b(?![^<]*>)`, "gi");
      safe = safe.replace(reg, `<span class="text-cyan-400 font-semibold">$1</span>`);
    });

    return safe;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Highlighter };
}

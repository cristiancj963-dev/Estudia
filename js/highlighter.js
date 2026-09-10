/**
 * MOTOR DE RESALTADO INTELIGENTE Y LECTURA RÁPIDA (KEYWORD HIGHLIGHTER)
 * Diseñado específicamente para preguntas complejas de certificación AWS SAP-C02.
 * 
 * Principio de Reconocimiento Rápido:
 * 1. Palabras Gatillo / Restricciones / Preguntas en ÁMBAR (llamativo para descartes rápidos)
 * 2. Servicios AWS y Componentes de Arquitectura en CIAN (fijación visual técnica)
 * 
 * Implementación segura basada en tokens para evitar colisiones HTML y reemplazos anidados.
 */

const Highlighter = {
  // Palabras clave de restricciones críticas, métricas, SLAs y directivas del examen
  criticalKeywords: [
    // Directivas de optimización y negocio
    "LEAST operational overhead", "least operational overhead", "minimal operational overhead",
    "LARGEST overall cost reduction", "largest overall cost reduction",
    "MOST cost-effectively", "most cost-effectively", "MOST cost-effective", "most cost-effective",
    "minimize cost", "minimizing costs", "cost reduction", "cost-effective",
    "HIGHEST performance", "highest performance", "high performance access", "high performance",
    "LOWEST latency", "lowest latency", "sub-millisecond latency", "sub-millisecond", "sub-minute",
    "least operational effort", "LEAST operational effort", "least administrative effort", "minimal operational effort",
    "minimizes operational complexity", "minimizing operational complexity",
    "least possible downtime", "zero downtime", "without downtime", "without interruptions",
    "least privilege", "least-privilege",

    // SLA, Disponibilidad y Resiliencia
    "RTO less than", "RTO to less than", "RPO less than", "RTO", "RPO",
    "highly available", "high availability", "fault tolerant", "fault-tolerant",
    "automatically fail over", "automatic failover", "disaster recovery",
    "pilot light", "warm standby", "active-active", "active-passive",
    "ransomware attacks", "ransomware", "immutable", "WORM",

    // Restricciones de red y acceso
    "fixed address assignments", "allow lists", "allow list", "whitelist",
    "static IP", "static port", "TCP on a static port", "static TCP port",
    "private connectivity", "without traversing the internet", "without internet",
    "cross-account", "cross-region", "multi-account", "multi-region", "multi-AZ",
    "single location", "managed in a single location", "conditional access",

    // Métricas y volumetría de datos
    "200 TB", "100 TB", "50 TB", "petabytes", "terabytes",
    "1 Gbps", "10 Gbps", "100 Gbps",
    "once monthly", "72 hours", "72-hour run", "real-time", "near-real-time",
    "peaks in certain months", "variable traffic", "traffic spikes", "data-intensive",

    // Identidad y Protocolos
    "Active Directory", "SAML 2.0", "SCIM v2.0", "SCIM", "ABAC", "RBAC",
    "permission sets", "SCP", "SCPs", "Service Control Policies",
    "lazy loading", "batch loading", "compliance mode",

    // Modos de selección de respuesta
    "Choose two", "Choose three", "Choose four",
    "Which combination of steps", "Which solution will meet"
  ],

  // Servicios AWS y Protocolos Técnicos
  awsServices: [
    // Redes y Conectividad Híbrida
    "Direct Connect gateway", "AWS Direct Connect", "Direct Connect", "DXGW",
    "AWS Transit Gateway", "Transit Gateway", "TGW",
    "AWS PrivateLink", "PrivateLink", "Interface VPC Endpoint", "Gateway Endpoint",
    "Site-to-Site VPN", "Virtual Private Gateway", "VGW", "Customer Gateway",
    "Amazon Route 53", "Route 53", "private hosted zone", "inbound resolver", "outbound resolver",
    "Network Load Balancer", "NLB", "Application Load Balancer", "ALB",
    "AWS Global Accelerator", "Global Accelerator", "VPC Peering", "Elastic IP",

    // Almacenamiento y Archivos
    "Amazon FSx for Lustre", "FSx for Lustre", "Amazon FSx for Windows", "Amazon FSx for NetApp ONTAP", "Amazon FSx", "FSx",
    "S3 Intelligent-Tiering", "S3 Standard", "S3 Glacier Deep Archive", "S3 Glacier Flexible", "S3 Glacier",
    "Amazon S3", "S3 Object Lock", "S3 File Gateway", "S3 event notification", "S3 event notifications",
    "Amazon EFS", "Amazon EBS", "AWS Storage Gateway", "AWS Backup", "Backup Vault Lock", "AWS Backup vaults",

    // Cómputo, Serverless y Contenedores
    "AWS Lambda", "Amazon ECS", "AWS Fargate", "Fargate", "Amazon EKS", "Amazon ECR",
    "Amazon EC2", "Auto Scaling group", "Auto Scaling", "AWS Elastic Beanstalk", "Elastic Beanstalk",
    "AWS Step Functions", "Step Functions", "Amazon EventBridge", "EventBridge",

    // Bases de Datos y Caché
    "Amazon Aurora", "Aurora Global Database", "Aurora Serverless", "Aurora Replicas", "Aurora MySQL", "Aurora PostgreSQL",
    "Amazon RDS", "RDS Proxy", "Amazon DynamoDB", "DynamoDB Global Tables", "DynamoDB DAX", "DynamoDB",
    "Amazon ElastiCache", "ElastiCache for Redis", "Amazon MemoryDB", "Amazon Redshift", "Amazon OpenSearch",

    // Identidad, Seguridad y Gobernanza
    "AWS IAM Identity Center", "IAM Identity Center", "AWS Single Sign-On", "AWS SSO",
    "AWS Organizations", "AWS IAM", "AWS Secrets Manager", "AWS KMS", "KMS Multi-Region", "KMS",
    "AWS Systems Manager", "Systems Manager", "Session Manager", "Parameter Store",
    "AWS Config", "Amazon GuardDuty", "AWS Security Hub", "AWS WAF", "AWS Shield Advanced", "AWS Shield",
    "Amazon Macie", "AWS CloudTrail", "Amazon CloudWatch",

    // Migración, IA y Mensajería
    "Amazon Rekognition", "AWS Database Migration Service", "AWS DMS",
    "Amazon SQS", "SQS FIFO", "Amazon SNS", "Amazon Kinesis Data Streams", "Amazon Kinesis Data Firehose",
    "Amazon CloudFront", "CloudFront Functions", "Lambda@Edge", "AWS Transfer Family"
  ],

  /**
   * Resalta texto con etiquetas HTML seguras sin corromper el contenido.
   * Utiliza sustitución por tokens de longitud descendente.
   */
  highlight(text) {
    if (!text) return "";

    // 1. Escapar caracteres HTML para evitar inyecciones
    let safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const tokens = [];
    const createToken = (htmlContent) => {
      const token = `___HLTOK_${tokens.length}___`;
      tokens.push(htmlContent);
      return token;
    };

    // 2. Ordenar por longitud descendente para que las frases compuestas coincidan antes que las simples
    const sortedKeywords = [...new Set(Highlighter.criticalKeywords)]
      .sort((a, b) => b.length - a.length);

    const sortedServices = [...new Set(Highlighter.awsServices)]
      .sort((a, b) => b.length - a.length);

    // 3. Procesar Requisitos Críticos (Ámbar)
    for (const kw of sortedKeywords) {
      const escaped = kw.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const regex = new RegExp(`\\b(${escaped})\\b`, "gi");
      safe = safe.replace(regex, (match) => {
        return createToken(`<mark class="bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/40">${match}</mark>`);
      });
    }

    // 4. Procesar Servicios AWS (Cian)
    for (const svc of sortedServices) {
      const escaped = svc.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const regex = new RegExp(`\\b(${escaped})\\b`, "gi");
      safe = safe.replace(regex, (match) => {
        return createToken(`<span class="text-cyan-400 font-semibold">${match}</span>`);
      });
    }

    // 5. Reemplazar tokens de vuelta a su código HTML final
    for (let i = tokens.length - 1; i >= 0; i--) {
      safe = safe.replace(`___HLTOK_${i}___`, tokens[i]);
    }

    return safe;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Highlighter };
}

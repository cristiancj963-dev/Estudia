/**
 * REPEMILL CONCEPTUAL - AWS SAP-C02
 * Plataforma de Alto Rendimiento
 * Estructura de Patrones: [Palabra Gatillo / Requisito] | [Servicio AWS Óptimo] | [Patrón de Descarte Rápido]
 */

const REPEMILL_DATA = {
  1: {
    title: "Bloque 1 (Q1 - Q25): Hibridación DNS, Resiliencia Multi-Región & Redes Compartidas",
    patterns: [
      {
        trigger: "DNS On-Premises resuelve nombres de Route 53 Private Hosted Zone en VPC",
        optimalService: "Route 53 Inbound Resolver (en Shared Services VPC conectado por Direct Connect / TGW)",
        discardPattern: "Descartar Outbound Resolver (este resuelve peticiones de AWS a On-Prem). Descartar EC2 Bind/Forwarders por overhead operacional.",
        category: "Networking & Content Delivery",
        mnemonic: "Inbound = Entrada de consultas desde fuera hacia AWS. Outbound = Salida hacia tus servidores locales."
      },
      {
        trigger: "API REST Multi-Región con conmutación por error (Failover) y baja latencia",
        optimalService: "Route 53 Failover Record + API Gateway regional + DynamoDB Global Tables",
        discardPattern: "Descartar Edge-Optimized con múltiples orígenes de Lambda en varias regiones en un solo API Gateway (no admite failover regional nativo entre lambdas).",
        category: "Serverless & Compute",
        mnemonic: "DynamoDB Global + Route 53 Failover = Pareja dorada para RTO cero en serverless multi-región."
      },
      {
        trigger: "Bloquear acciones en raíz de AWS Organizations sin romper nuevos despliegues",
        optimalService: "Crear OU temporal de Onboarding con SCP permisiva; mover cuenta a Production OU tras ajustar Config",
        discardPattern: "Descartar alterar SCPs de Root de Deny a Allow (rompe la postura de seguridad global y aumenta complejidad).",
        category: "Security & Governance",
        mnemonic: "La OU de Onboarding es la 'cuarentena' controlada antes de ingresar al hospital de Producción."
      },
      {
        trigger: "Escalar base de datos transaccional con sesiones persistentes (Sticky Sessions)",
        optimalService: "Aurora Read Replicas (Auto Scaling) + ALB con Sticky Sessions (Round Robin)",
        discardPattern: "Descartar NLB con sticky sessions cuando se requiere HTTP cookie tracking; descartar escalar Aurora Writers (Aurora solo tiene 1 writer por clúster en modo estándar).",
        category: "Databases & Scaling",
        mnemonic: "Aurora escala réplicas lectoras automáticamente; el ALB reparte con pegamento (cookie)."
      },
      {
        trigger: "Manipulación de cabeceras HTTP de dispositivos antiguos (Viewer Response / Request) a coste mínimo",
        optimalService: "CloudFront + CloudFront Functions (o Lambda@Edge si requiere transformar cuerpo)",
        discardPattern: "Descartar API Gateway default responses (no intercepta el flujo de vuelta si viene de orígenes no integrados con transformaciones complejas).",
        category: "Edge & Performance",
        mnemonic: "CloudFront Functions = Solo Headers/URL, microsegundos y 1/6 de coste de Lambda@Edge."
      },
      {
        trigger: "Acceso cross-account a S3 sin asumir roles intermediarios complejos",
        optimalService: "S3 Bucket Policy en Cuenta A (con Principal el IAM User de Cuenta B) + IAM Policy en Cuenta B concediendo s3:GetObject",
        discardPattern: "Descartar CORS (CORS es para navegadores cruzando dominios web, no para llamadas AWS API/CLI entre cuentas).",
        category: "Security & Storage",
        mnemonic: "La llave (IAM policy en B) debe coincidir con la cerradura (Bucket policy en A). Sin ambas, acceso denegado."
      },
      {
        trigger: "Migrar microservicios en contenedores minimizando sobrecarga operativa y con coste predecible",
        optimalService: "Amazon ECS con Fargate Launch Type + Amazon ECR + ALB",
        discardPattern: "Descartar Amazon EKS si el requisito exige 'minimizar complejidad operativa' (Kubernetes añade capas de mantenimiento).",
        category: "Containers",
        mnemonic: "Fargate = Contenedores 'sin servidor' de mantenimiento cero. EKS = Solo si piden orquestación multi-cloud/K8s nativo."
      },
      {
        trigger: "RTO < 15 min en failover de EC2/RDS sin presupuesto para activo-activo",
        optimalService: "Route 53 Health Check + SNS + Lambda para promover RDS Read Replica y activar Auto Scaling Group (ASG) de respaldo",
        discardPattern: "Descartar Global Accelerator o Active-Active con capacidad aprovisionada continua (viola la restricción de presupuesto).",
        category: "Disaster Recovery",
        mnemonic: "Pilot Light / Warm Standby: la base de datos se replica pasiva, y Lambda 'enciende las luces' al sonar la alarma."
      },
      {
        trigger: "Centralizar gestión de red en cuenta dedicada de infraestructura sin que las cuentas miembros administren VPCs",
        optimalService: "AWS RAM (Resource Access Manager) compartiendo subredes (VPC Sharing) organizacionales",
        discardPattern: "Descartar VPC Peering entre cientos de VPCs individuales (genera maraña de rutas e infringe la prohibición de administrar VPCs individuales).",
        category: "Networking",
        mnemonic: "RAM VPC Sharing = Una sola autopista central donde cada inquilino solo aparca en su plaza asignada."
      },
      {
        trigger: "Consumir servicio SaaS privado de un tercero en AWS sin tráfico por Internet",
        optimalService: "AWS PrivateLink (Interface VPC Endpoint apuntando al Endpoint Service del proveedor)",
        discardPattern: "Descartar VPC Peering (requiere CIDRs no solapados, enruta bidireccionalmente y expone toda la red).",
        category: "Networking & Security",
        mnemonic: "PrivateLink = Enchufe unidireccional privado a través del hipervisor. Cero exposición a Internet."
      },
      {
        trigger: "Asociar Route 53 Private Hosted Zone en Cuenta A con VPC en Cuenta B (Cross-Account DNS)",
        optimalService: "Cuenta A ejecuta CreateVPCAssociationAuthorization para autorizar la VPC + Cuenta B ejecuta AssociateVPCWithHostedZone (y borrar autorización tras asociar)",
        discardPattern: "Descartar replicar o duplicar zonas privadas entre cuentas (Route 53 no admite replicación entre cuentas). Descartar editar /etc/resolv.conf con IPs estáticas.",
        category: "DNS & Multi-Account",
        mnemonic: "Private Hosted Zone Cross-Account = 1º Cuenta A autoriza (CreateVPCAssociationAuthorization) -> 2º Cuenta B asocia (AssociateVPCWithHostedZone)."
      },
      {
        trigger: "Direct Connect redundante + expansión hacia múltiples Regiones (Multi-Region) con mínima sobrecarga",
        optimalService: "Direct Connect Gateway (DXGW) con Private VIFs hacia múltiples VPCs en distintas Regiones de AWS",
        discardPattern: "Descartar Transit Gateway si no hay routing inter-VPC complejo (DXGW es directo y no cobra procesamiento por GB de TGW). Descartar Public VIF (la VIF pública es solo para servicios públicos como S3). Descartar conectar VGW directo sin DXGW (un VGW solo llega a una única región).",
        category: "Hybrid Networking",
        mnemonic: "DXGW = El pasaporte global de Direct Connect para llegar a múltiples Regiones con VIF privada."
      },
      {
        trigger: "Ingesta y análisis de medios (vídeos/fotos) con picos de tráfico + sustituir software custom + reducir sobrecarga operativa (Serverless)",
        optimalService: "Frontend estático en Amazon S3 + S3 Event Notifications a Amazon SQS + AWS Lambda worker + Amazon Rekognition",
        discardPattern: "Descartar Elastic Beanstalk o flotas de EC2/EFS que mantienen servidores aprovisionados con coste ocioso continuo. Descartar la respuesta oficial desactualizada (D) y forzar C avalada por la comunidad (86% serverless).",
        category: "Serverless & Media Processing",
        mnemonic: "Subida de medios a picos = S3 Event Notification -> SQS -> Lambda -> Rekognition. Cero servidores aprovisionados."
      },
      {
        trigger: "Federar Active Directory On-Premises con múltiples cuentas en AWS Organizations + gestión centralizada en un solo punto + SCIM / SAML 2.0",
        optimalService: "AWS IAM Identity Center (Single Sign-On) con SAML 2.0 hacia AD + aprovisionamiento automático SCIM v2.0 + ABAC / Permission Sets",
        discardPattern: "Descartar crear usuarios o roles IAM individualmente en cada cuenta miembro (rompe el requisito explícito de gestión en una sola ubicación). Descartar OIDC para Active Directory clásico local.",
        category: "Identity & Governance",
        mnemonic: "Organizations + Active Directory = IAM Identity Center (AWS SSO) + SCIM. Gestión en 1 solo punto centralizado."
      },
      {
        trigger: "Cálculo batch / HPC sobre gran volumen (200 TB) que corre una vez al mes durante 72 horas + máxima reducción global de costes",
        optimalService: "Datos persistentes en Amazon S3 (S3 Intelligent-Tiering) + clúster efímero de Amazon FSx for Lustre (lazy loading) creado para las 72h y destruido al terminar",
        discardPattern: "Descartar mantener instancias EC2 o sistemas de almacenamiento dedicados encendidos todo el mes para un trabajo que solo dura 3 días. Descartar EBS Multi-Attach (máx 16 instancias Nitro, no cientos).",
        category: "Storage & HPC Cost Reduction",
        mnemonic: "HPC mensual puntual de 72h = S3 para reposo económico + FSx for Lustre efímero que se destruye tras el job."
      },
      {
        trigger: "Tráfico TCP en puerto estático / no HTTP + IPs fijas para Allow Lists de clientes externos + alta disponibilidad Multi-AZ",
        optimalService: "Network Load Balancer (NLB) con una Elastic IP fija por cada Availability Zone + Alias Record en Route 53",
        discardPattern: "Descartar Application Load Balancer (ALB solo opera en Capa 7 HTTP/HTTPS y sus IPs cambian dinámicamente). Descartar Elastic IPs directas en instancias EC2 o contenedores (rompe la alta disponibilidad y la conmutación transparente ante fallos).",
        category: "Load Balancing & Security",
        mnemonic: "TCP + IPs fijas para Allow List externa = Network Load Balancer (NLB) con Elastic IPs fijas por cada AZ."
      }
    ]
  },
  2: {
    title: "Bloque 2 (Q26 - Q50): Bases de Datos Globales, Replicación Continua & Migración sin Caída",
    patterns: [
      {
        trigger: "Migrar base de datos on-premises a AWS sin interrupción y desacoplar reportes pesados de la ingesta",
        optimalService: "AWS DMS (Continuous Replication) a Aurora MySQL + Aurora Read Replica para reportes + RDS Proxy",
        discardPattern: "Descartar snapshots estáticos o exportación manual (causan downtime); descartar usar la instancia primaria para reportes analíticos.",
        category: "Databases & Migration",
        mnemonic: "DMS copia sin parar; RDS Proxy absorbe conexiones de Lambda; la réplica atiende los reportes."
      },
      {
        trigger: "Interconectar decenas de VPCs entre múltiples regiones y on-prem con enrutamiento simplificado",
        optimalService: "AWS Transit Gateway con TGW Inter-Region Peering",
        discardPattern: "Descartar malla completa de VPC Peering (límite de complejidad N*(N-1)/2 y sin soporte de enrutamiento transitivo).",
        category: "Networking",
        mnemonic: "Transit Gateway = La rotonda central. Elimina cables cruzados entre regiones y centros de datos."
      },
      {
        trigger: "Detección de información confidencial y PII en S3 de forma automatizada",
        optimalService: "Amazon Macie + Amazon EventBridge + AWS Lambda para remediación",
        discardPattern: "Descartar Amazon Inspector (Inspector escanea vulnerabilidades en EC2/contenedores, no analiza PII en S3).",
        category: "Security & Compliance",
        mnemonic: "Macie = El detective de datos sensibles en S3. Inspector = El médico que revisa el sistema operativo."
      },
      {
        trigger: "Ingesta masiva de telemetría de sensores en streaming con entrega casi en tiempo real a S3/OpenSearch",
        optimalService: "Amazon Kinesis Data Firehose (con buffer ajustable de 60 segundos)",
        discardPattern: "Descartar Kinesis Data Streams si no se requiere procesamiento personalizado en milisegundos (Firehose no requiere gestionar shards ni consumidores).",
        category: "Analytics & Streaming",
        mnemonic: "Firehose = Manguera automática directa al depósito (S3/Redshift). Cero gestión de servidores o shards."
      },
      {
        trigger: "Cifrado KMS multi-región con idéntico Key ID para respaldos en varias regiones",
        optimalService: "KMS Multi-Region Primary Key con Replica Keys en regiones secundarias",
        discardPattern: "Descartar claves independientes KMS regionales para datos que se replican cifrados sin re-encriptar en tránsito.",
        category: "Security & Encryption",
        mnemonic: "Multi-Region Key = Mismo ARN de clave, misma llave maestra duplicada en las cajas fuertes de cada región."
      },
      {
        trigger: "Base de datos relacional global con latencia de réplica < 1 segundo y recuperación rápida de desastres",
        optimalService: "Amazon Aurora Global Database (replicación basada en almacenamiento de milisegundos)",
        discardPattern: "Descartar RDS MySQL Multi-AZ Cross-Region Read Replica con replicación binaria tradicional (mayor lag y mayor RPO).",
        category: "Databases",
        mnemonic: "Aurora Global = Replicación a nivel de disco sin tocar el motor de base de datos. RPO < 1s garantizado."
      }
    ]
  },
  3: {
    title: "Bloque 3 (Q51 - Q75): Gobernanza Multi-Cuenta, Control Tower & Arquitecturas Serverless",
    patterns: [
      {
        trigger: "Transformar datos de S3 al vuelo según el consumidor (ej. enmascarar datos para analytics)",
        optimalService: "S3 Object Lambda (invoca función Lambda transparente durante el GetObject)",
        discardPattern: "Descartar duplicar datos en múltiples buckets con scripts batch (genera costes de almacenamiento redundantes y desfase).",
        category: "Serverless & Storage",
        mnemonic: "Object Lambda = Filtro de café que endulza o descafeína el archivo al momento de servirlo."
      },
      {
        trigger: "Distribución de eventos asíncronos entre múltiples cuentas AWS con reglas de filtrado",
        optimalService: "Amazon EventBridge Event Bus Central con Resource Policy y reglas de reenvío",
        discardPattern: "Descartar SNS con suscripciones SQS cruzadas punto a punto masivas (difícil de mantener y sin filtrado rico de esquema).",
        category: "Integration & Messaging",
        mnemonic: "EventBridge = Central telefónica inteligente para conectar microservicios y cuentas sin acoplamiento."
      },
      {
        trigger: "Almacenamiento de alto rendimiento para computación científica / HPC conectado nativamente a S3",
        optimalService: "Amazon FSx for Lustre con repositorio de datos enlazado a S3",
        discardPattern: "Descartar Amazon EFS para cargas HPC intensivas de millones de IOPS y streaming de sub-milisegundos.",
        category: "Storage & HPC",
        mnemonic: "Lustre = Velocidad supersónica para Machine Learning y simulación masiva conectado a S3."
      },
      {
        trigger: "Imponer estándares obligatorios de creación de recursos en todas las cuentas de la organización",
        optimalService: "AWS Control Tower con Guardrails (Controles Detectivos y Preventivos) + AWS Service Catalog",
        discardPattern: "Descartar scripts manuales de Terraform ejecutados cuenta por cuenta sin control centralizado de gobernanza.",
        category: "Governance & Security",
        mnemonic: "Control Tower = La torre de control del aeropuerto que no permite despegar ningún avión sin chequeo."
      },
      {
        trigger: "Protección contra ataques DDoS de Capa 7 y picos de tráfico malicioso en CloudFront/ALB",
        optimalService: "AWS WAF con Rate-based Rules y Managed Rule Groups",
        discardPattern: "Descartar Security Groups (los SG no inspeccionan contenido HTTP ni pueden contar peticiones por segundo por IP).",
        category: "Security & DDoS",
        mnemonic: "WAF = El portero de discoteca que lee las solicitudes HTTP y frena a los que piden 500 copas por minuto."
      }
    ]
  },
  4: {
    title: "Bloque 4 (Q76 - Q100): Almacenamiento Híbrido, Transfer Family & Respaldos Organizacionales",
    patterns: [
      {
        trigger: "Acceso SMB/NFS on-premises a almacenamiento en la nube con caché local de baja latencia",
        optimalService: "AWS Storage Gateway (File Gateway / Amazon S3 File Gateway)",
        discardPattern: "Descartar Volume Gateway Stored si se requiere ver los archivos como objetos directos en S3.",
        category: "Hybrid Storage",
        mnemonic: "S3 File Gateway = Ventana mágica en tu LAN que guarda en S3 como archivos y carpetas estándar."
      },
      {
        trigger: "Conectar On-Premises vía Site-to-Site VPN a múltiples VPCs interconectadas (sin enrutamiento transitivo por Peering) con mínimo esfuerzo operativo",
        optimalService: "AWS Transit Gateway (TGW) conectando la VPN, VPC A y VPC B en arquitectura Hub-and-Spoke",
        discardPattern: "Descartar VPC Peering para tráfico on-premises (VPC Peering NO soporta enrutamiento transitivo edge-to-edge entre VPN y otra VPC). Descartar crear túneles VPN independientes punto a punto hacia cada VPC por sobrecarga operativa.",
        category: "Hybrid Networking",
        mnemonic: "VPC Peering es NO transitivo. Para que el centro on-premises hable con VPC B a través de AWS = Transit Gateway (TGW)."
      },
      {
        trigger: "Migrar servidores SFTP existentes sin cambiar clientes ni credenciales de usuario",
        optimalService: "AWS Transfer Family integrado con Identity Provider personalizado (Lambda + Secrets Manager)",
        discardPattern: "Descartar montar instancias EC2 con vsftpd/OpenSSH administradas manualmente (alto coste operativo y parches).",
        category: "Storage & Migration",
        mnemonic: "Transfer Family = Servidor SFTP/FTPS/FTP gestionado por AWS sin preocuparte de Linux ni de escalabilidad."
      },
      {
        trigger: "Automatizar políticas de respaldo y retención inmutable en múltiples cuentas AWS",
        optimalService: "AWS Backup con integración en AWS Organizations + Backup Vault Lock",
        discardPattern: "Descartar scripts cron con AWS CLI haciendo snapshots en cada cuenta (no cumplen auditoría WORM y carecen de bloqueo).",
        category: "Backup & Compliance",
        mnemonic: "Vault Lock = El candado que ni el root de AWS puede abrir antes de que expire la fecha de retención (WORM)."
      },
      {
        trigger: "Garantizar cumplimiento normativo continuo y autorremediación de configuraciones desviadas",
        optimalService: "AWS Config con Conformance Packs y remediación automática vía Systems Manager Automation",
        discardPattern: "Descartar CloudTrail por sí solo (CloudTrail solo registra eventos pasados, no audita el estado actual ni autorremedia).",
        category: "Compliance & Governance",
        mnemonic: "Config = El auditor permanente que detecta cuando alguien deja un bucket público y lo vuelve a cerrar al instante."
      }
    ]
  },
  5: {
    title: "Bloque 5 (Q101 - Q125): Conectividad Dedicada Direct Connect, VPN IPsec & Cifrado en Tránsito",
    patterns: [
      {
        trigger: "Conexión dedicada de 10 Gbps con cifrado IPsec a máxima velocidad hacia Transit Gateway",
        optimalService: "AWS Direct Connect con MACsec (IEEE 802.1AE) o VPN IPsec sobre Direct Connect Transit VIF",
        discardPattern: "Descartar VPN por Internet pública si se exige ancho de banda garantizado de 10Gbps constante.",
        category: "Networking & Security",
        mnemonic: "Direct Connect + MACsec = Cifrado a nivel de cable físico (Capa 2) sin penalizar los 10 o 100 Gbps."
      },
      {
        trigger: "Acceso a múltiples VPCs en distintas regiones a través de una sola conexión Direct Connect física",
        optimalService: "Direct Connect Gateway (DX Gateway) asociado a un Transit Gateway o Private VIFs",
        discardPattern: "Descartar crear una conexión física Direct Connect por cada VPC o por cada región (coste astronómico).",
        category: "Networking",
        mnemonic: "Direct Connect Gateway = El adaptador universal que conecta tu cable local a cualquier región del planeta."
      },
      {
        trigger: "Compartir claves KMS administradas por el cliente (CMK) con cuentas externas de forma segura",
        optimalService: "KMS Key Policy permitiendo a la cuenta externa + IAM Policy en la cuenta externa permitiendo kms:Decrypt/GenerateDataKey",
        discardPattern: "Descartar AWS Managed Keys (aws/s3) porque sus políticas NO pueden editarse para permitir acceso cross-account.",
        category: "Security & Encryption",
        mnemonic: "Solo las Customer Managed Keys (CMK) abren la puerta a otras cuentas. Las llaves por defecto de AWS son egoístas."
      },
      {
        trigger: "Autenticar usuarios en API Gateway usando tokens JWT de proveedores OAuth2/OIDC externos",
        optimalService: "API Gateway HTTP API con JWT Authorizer nativo (o REST API con Lambda Authorizer)",
        discardPattern: "Descartar IAM Authentication si los usuarios finales no tienen credenciales de AWS.",
        category: "Serverless & Identity",
        mnemonic: "JWT Authorizer = Comprobación instantánea del token criptográfico sin gastar milisegundos de Lambda."
      }
    ]
  },
  6: {
    title: "Bloque 6 (Q126 - Q150): Mensajería Asíncrona, Desacoplamiento Estricto & Orquestación",
    patterns: [
      {
        trigger: "Procesamiento de transacciones bancarias o pedidos en orden cronológico estricto sin duplicados",
        optimalService: "Amazon SQS FIFO con Message Deduplication ID y Message Group ID",
        discardPattern: "Descartar SQS Standard (SQS Standard garantiza 'at-least-once delivery' pero NO orden estricto y puede duplicar).",
        category: "Application Integration",
        mnemonic: "FIFO = First In, First Out con candado antiduplicados. Standard = Rápido pero desordenado."
      },
      {
        trigger: "Orquestar flujos de trabajo serverless complejos con control de reintentos, esperas y rollback",
        optimalService: "AWS Step Functions (State Machines)",
        discardPattern: "Descartar encadenar llamadas directas Lambda a Lambda con variables de entorno (código espagueti y propenso a timeouts).",
        category: "Serverless & Orchestration",
        mnemonic: "Step Functions = El director de orquesta visual. Sabe qué instrumento toca después y qué hacer si uno desafina."
      },
      {
        trigger: "Base de datos NoSQL con latencia de un solo dígito de milisegundo y replicación multi-región activa-activa",
        optimalService: "Amazon DynamoDB Global Tables con On-Demand capacity y Streams",
        discardPattern: "Descartar clústeres Cassandra en EC2 gestionados manualmente si se busca cero sobrecarga operativa.",
        category: "Databases",
        mnemonic: "DynamoDB Global = Escribe en Tokio y lee en Virginia en milisegundos. Escalabilidad infinita."
      },
      {
        trigger: "Procesar millones de archivos en S3 en paralelo mediante flujos serverless masivos",
        optimalService: "AWS Step Functions Distributed Map integrado con S3",
        discardPattern: "Descartar un único script monolítico en Lambda (chocará contra el límite de 15 minutos de ejecución).",
        category: "Serverless Analytics",
        mnemonic: "Distributed Map = Divide y vencerás. Lanza hasta 10.000 tareas paralelas leyendo directamente de S3."
      }
    ]
  },
  7: {
    title: "Bloque 7 (Q151 - Q175): Distribución de Contenido Seguro, WebSockets & APIs de Tiempo Real",
    patterns: [
      {
        trigger: "Chat interactivo bidireccional o cotizaciones bursátiles en tiempo real",
        optimalService: "Amazon API Gateway WebSocket API o ALB con WebSockets habilitados",
        discardPattern: "Descartar API Gateway REST clásico con polling frecuente desde el cliente (satura la infraestructura y aumenta latencia).",
        category: "Application Integration",
        mnemonic: "WebSocket = Teléfono descolgado permanentemente hablando en ambas direcciones."
      },
      {
        trigger: "Proteger contenido de video premium en CloudFront para usuarios suscritos individuales",
        optimalService: "CloudFront Signed URLs (para archivos individuales) o Signed Cookies (para múltiples archivos HLS/DASH)",
        discardPattern: "Descartar tokens en Query String pasados al servidor de origen sin validación en el Edge (no aprovecha la caché segura de CloudFront).",
        category: "Content Delivery & Security",
        mnemonic: "Signed URLs = Pase VIP para una película. Signed Cookies = Pulsera de barra libre para todo el festival."
      },
      {
        trigger: "Equilibrio de carga para tráfico TCP/UDP no HTTP con millones de conexiones por segundo y baja latencia",
        optimalService: "Network Load Balancer (NLB) con IP elástica estática",
        discardPattern: "Descartar Application Load Balancer (ALB opera en Capa 7 HTTP/HTTPS, no admite UDP crudo ni IPs estáticas nativas en cada subnet sin Global Accelerator).",
        category: "Networking",
        mnemonic: "NLB = Capa 4 a la velocidad de la luz y con IPs fijas. ALB = Capa 7 inteligente para URLs y cookies."
      },
      {
        trigger: "Acelerar tráfico global de usuarios hacia aplicaciones web en una sola región minimizando pérdida de paquetes",
        optimalService: "AWS Global Accelerator (utiliza la red global troncal privada de AWS con Anycast IP estática)",
        discardPattern: "Descartar Route 53 Latency-based routing si solo hay una región destino (Route 53 no cambia la ruta de Internet pública).",
        category: "Global Networking",
        mnemonic: "Global Accelerator = Autopista privada exclusiva de AWS con 2 IPs Anycast fijas para saltarse el tráfico público de Internet."
      }
    ]
  },
  8: {
    title: "Bloque 8 (Q176 - Q200): Ciclos de Vida de Datos, Optimización de Costes S3 & Bases de Datos Elásticas",
    patterns: [
      {
        trigger: "Archivar datos de S3 a los que rara vez se accede pero deben recuperarse en milisegundos cuando se solicitan",
        optimalService: "S3 Glacier Instant Retrieval",
        discardPattern: "Descartar S3 Glacier Flexible Retrieval (requiere de 1 a 5 minutos en modo expedited o de 3 a 5 horas estándar).",
        category: "Storage Optimization",
        mnemonic: "Instant Retrieval = Archivo congelado que se descongela en milisegundos con precio de Glacier."
      },
      {
        trigger: "Patrón de tráfico impredecible en base de datos relacional con periodos de inactividad total",
        optimalService: "Amazon Aurora Serverless v2 (escala en fracciones de ACUs de forma instantánea)",
        discardPattern: "Descartar instancias RDS EC2 sobreaprovisionadas para picos (malgasta presupuesto en horas valle).",
        category: "Databases & Cost",
        mnemonic: "Aurora Serverless = El grifo que se abre al máximo con el chorro y se cierra a una gota cuando nadie mira."
      },
      {
        trigger: "Recuperación ante desastres de DynamoDB contra borrados accidentales o corrupción lógica",
        optimalService: "DynamoDB Point-in-Time Recovery (PITR) con retención continua de 35 días",
        discardPattern: "Descartar scripts de exportación periódica a S3 mediante cron (dejan ventanas de datos sin capturar ante fallos súbitos).",
        category: "Disaster Recovery",
        mnemonic: "PITR = Rebobinado de cinta de video al segundo exacto anterior al error del becario."
      },
      {
        trigger: "Federación de identidades SAML 2.0 con IdP on-premises (resolución de problemas cuando usuarios no pueden autenticarse)",
        optimalService: "Verificar Trust Policy del IAM Role (Principal: SAML Provider) + STS AssumeRoleWithSAML + Mapeo de aserciones SAML en el IdP",
        discardPattern: "Descartar requerir conectividad directa desde las VPCs al IdP on-premises (la autenticación SAML es redirigida vía browser web del usuario, no desde la VPC). Descartar políticas sobre IAM Users (en federación SAML no se crean IAM Users locales en AWS).",
        category: "Identity Federation & SAML",
        mnemonic: "Flujo SAML 2.0 = Navegador -> IdP (afirmación SAML) -> STS AssumeRoleWithSAML -> IAM Role temporal. La VPC de AWS no contacta al IdP."
      }
    ]
  },
  9: {
    title: "Bloque 9 (Q201 - Q225): Gestión Operativa sin Servidor, Bastion Hosts & Parcheo Automatizado",
    patterns: [
      {
        trigger: "Acceso seguro por terminal a instancias EC2 en subredes privadas sin abrir puertos SSH (22) ni exponer IPs públicas",
        optimalService: "AWS Systems Manager Session Manager (con IAM Role en la instancia EC2)",
        discardPattern: "Descartar Bastion Hosts con IP pública y puerto 22 abierto en Security Group (crea vectores de ataque por fuerza bruta).",
        category: "Management & Security",
        mnemonic: "Session Manager = Conexión segura por el canal TLS del agente SSM. Cero puertos de entrada abiertos."
      },
      {
        trigger: "Parcheo periódico y generación de informes de cumplimiento unificados para EC2 y servidores On-Premises",
        optimalService: "AWS Systems Manager Patch Manager con Patch Baselines y Maintenance Windows",
        discardPattern: "Descartar AWS OpsWorks o scripts manuales desarticulados (OpsWorks está desaconsejado para nuevos despliegues).",
        category: "Systems Operations",
        mnemonic: "Patch Manager = El calendario central de vacunas para todas tus máquinas físicas y virtuales."
      },
      {
        trigger: "Alinear capacidad de cómputo con patrones estacionales y tendencias históricas de tráfico",
        optimalService: "EC2 Auto Scaling con Predictive Scaling (utiliza Machine Learning para adelantarse al pico)",
        discardPattern: "Descartar Target Tracking reactivo por sí solo cuando el calentamiento de las instancias toma más de 15 minutos.",
        category: "Compute Scaling",
        mnemonic: "Predictive Scaling = El meteorólogo que prepara el paraguas antes de que empiece a llover."
      }
    ]
  },
  10: {
    title: "Bloque 10 (Q226 - Q250): Políticas SCP Avanzadas, Almacenamiento Compartido EFS & Mitigación DDoS",
    patterns: [
      {
        trigger: "Restringir el acceso a recursos de S3 para que SOLO sean accesibles por cuentas de la misma organización",
        optimalService: "Bucket Policy con condición 'aws:PrincipalOrgID': 'o-xxxxxxxxxx'",
        discardPattern: "Descartar listar manualmente las 50 cuentas AWS en la política (supera el límite de tamaño de política y genera fricción al añadir cuentas).",
        category: "Security & Organizations",
        mnemonic: "PrincipalOrgID = El pasaporte corporativo. Si no perteneces a la familia de la Org, puerta cerrada."
      },
      {
        trigger: "Sistema de archivos compartido POSIX para miles de instancias EC2 y contenedores ECS con rendimiento elástico",
        optimalService: "Amazon EFS con modo de rendimiento General Purpose o Max I/O y Lifecycle a Infrequent Access (IA)",
        discardPattern: "Descartar EBS Multi-Attach (EBS Multi-Attach solo funciona en la misma Zona de Disponibilidad y requiere sistema de archivos en clúster como GFS2).",
        category: "Storage",
        mnemonic: "EFS = La carpeta de red compartida para toda la región en múltiples zonas sin peleas de bloqueo."
      },
      {
        trigger: "Soporte 24/7 de ingenieros especializados durante ataques DDoS y reembolso de costes derivados del ataque",
        optimalService: "AWS Shield Advanced con acceso al AWS Shield Response Team (SRT)",
        discardPattern: "Descartar AWS Shield Standard (Standard es gratuito y pasivo, no ofrece soporte humano ni protección de costes).",
        category: "Security & DDoS",
        mnemonic: "Shield Advanced = El seguro a todo riesgo con línea directa a las fuerzas especiales de AWS."
      }
    ]
  },
  11: {
    title: "Bloque 11 (Q251 - Q275): Observabilidad Centralizada, Analítica de Logs & Alarmas Compuestas",
    patterns: [
      {
        trigger: "Supervisar métricas y alarmas en decenas de cuentas y regiones en un único panel centralizado",
        optimalService: "CloudWatch Cross-Account Cross-Region Dashboards con integración en AWS Organizations",
        discardPattern: "Descartar iniciar sesión en cada consola de cuenta individualmente o exportar métricas con scripts cada 5 minutos.",
        category: "Monitoring & Observability",
        mnemonic: "Cross-Account Dashboard = Pantalla de mando de la NASA que ve todas las estaciones espaciales a la vez."
      },
      {
        trigger: "Búsqueda y análisis de petabytes de logs en tiempo real con retención de bajo coste a largo plazo",
        optimalService: "Amazon OpenSearch Service con niveles UltraWarm y Cold Storage",
        discardPattern: "Descartar mantener todos los logs históricos en nodos 'Hot' con discos NVMe de alta velocidad (coste insostenible).",
        category: "Analytics & Logs",
        mnemonic: "UltraWarm & Cold = Mantiene los datos indexados y consultables respaldados por S3 a precio de saldo."
      },
      {
        trigger: "Disparar alarmas solo cuando coincidan múltiples condiciones anómalas (ej. CPU alta Y latencia alta)",
        optimalService: "Amazon CloudWatch Composite Alarms (Alarmas Compuestas con lógica booleana AND/OR)",
        discardPattern: "Descartar configurar notificaciones SNS separadas para cada alarma (provoca tormentas de alertas y fatiga mental del equipo de guardia).",
        category: "Alerting & Ops",
        mnemonic: "Composite Alarm = Solo suena la sirena si hay humo Y la temperatura supera los 80 grados."
      }
    ]
  },
  12: {
    title: "Bloque 12 (Q276 - Q300): Estrategias de Disaster Recovery, RPO/RTO & Replicación de Datos",
    patterns: [
      {
        trigger: "Requisitos de Disaster Recovery con RPO en minutos y RTO < 1 hora con costes moderados",
        optimalService: "Estrategia Warm Standby (versión reducida de la infraestructura corriendo permanentemente en la región secundaria)",
        discardPattern: "Descartar Backup & Restore tradicional (tarda horas en aprovisionar) y descartar Multi-site Active-Active si el presupuesto es acotado.",
        category: "Disaster Recovery",
        mnemonic: "Warm Standby = El motor del coche al ralentí; en caso de avería del principal, pisas el acelerador y sale andando."
      },
      {
        trigger: "Transferir archivos masivos de clientes vía protocolo SFTP directamente a buckets S3 con cifrado",
        optimalService: "AWS Transfer Family con endpoint VPC y S3 SSE-KMS",
        discardPattern: "Descartar soluciones de terceros en EC2 sin auto-scaling.",
        category: "Storage & Integration",
        mnemonic: "Transfer Family = Tu viejo cliente FileZilla hablando directamente con el almacenamiento de S3."
      },
      {
        trigger: "Base de datos Aurora tolerante a desastres a nivel de región completa con conmutación en menos de 1 minuto",
        optimalService: "Amazon Aurora Global Database con Managed Planned / Unplanned Failover",
        discardPattern: "Descartar restauración de snapshots entre regiones (lleva decenas de minutos y genera pérdida de datos).",
        category: "Databases",
        mnemonic: "Aurora Global = La base de datos omnipresente que no le teme a la caída de una región entera."
      }
    ]
  },
  13: {
    title: "Bloque 13 (Q301 - Q325): Enrutamiento Geográfico, DNS Inteligente & Reducción de Latencia",
    patterns: [
      {
        trigger: "Dirigir a usuarios europeos al datacenter de Frankfurt y a los de EE.UU. a Virginia según la ubicación del cliente",
        optimalService: "Route 53 Geolocation Routing Policy",
        discardPattern: "Descartar Geoproximity sin Route 53 Traffic Flow o Latency-based si el requisito es legal/geográfico estricto (ej. GDPR).",
        category: "Networking & DNS",
        mnemonic: "Geolocation = Mira de qué país o continente vienes y te manda a tu embajada correspondiente."
      },
      {
        trigger: "Reducir el tiempo de inicio en frío (Cold Start) en funciones AWS Lambda para Java / .NET",
        optimalService: "AWS Lambda SnapStart (para Java) o Provisioned Concurrency",
        discardPattern: "Descartar aumentar la memoria de Lambda a 10GB sin SnapStart (aumenta el coste sin resolver la inicialización pesada de JVM).",
        category: "Serverless Performance",
        mnemonic: "SnapStart = Foto fija de la memoria cargada lista para disparar en milisegundos."
      },
      {
        trigger: "Equilibrar tráfico web dinámico favoreciendo las regiones con menor latencia medida",
        optimalService: "Route 53 Latency Routing Policy con Target Health Checks",
        discardPattern: "Descartar Weighted Routing (el enrutamiento por peso es ciego al tiempo de respuesta de la red).",
        category: "Networking",
        mnemonic: "Latency Routing = El camino más corto en milisegundos para cada usuario."
      }
    ]
  },
  14: {
    title: "Bloque 14 (Q326 - Q350): Contenedores Elásticos, Spot Instances & Autenticación de Bases de Datos",
    patterns: [
      {
        trigger: "Reducir drásticamente el coste de tareas de procesamiento por lotes en contenedores tolerantes a fallos",
        optimalService: "Amazon ECS / EKS con Fargate Spot o EC2 Spot Instances",
        discardPattern: "Descartar On-Demand Instances con Savings Plans si la carga tolera interrupciones (Spot ofrece hasta un 90% de descuento).",
        category: "Cost Optimization & Compute",
        mnemonic: "Spot = Vuelos de última hora con billete barato a cambio de ceder el asiento si se llena."
      },
      {
        trigger: "Conectar aplicaciones a Amazon RDS MySQL/PostgreSQL sin almacenar contraseñas en código ni parámetros",
        optimalService: "Autenticación IAM para Base de Datos (IAM DB Authentication con tokens efímeros)",
        discardPattern: "Descartar hardcodear credenciales en variables de entorno o Parameter Store en texto plano.",
        category: "Security & Database",
        mnemonic: "IAM DB Auth = El token efímero de 15 minutos firmado por AWS. Adiós a cambiar contraseñas de BD."
      },
      {
        trigger: "Enrutar peticiones HTTP a microservicios distintos según la ruta (/api/v1, /orders) o el host (shop.example.com)",
        optimalService: "Application Load Balancer (ALB) Listener Rules con Path-based / Host-based routing",
        discardPattern: "Descartar colocar múltiples NLB o múltiples ALB para cada microservicio (multiplica costes innecesariamente).",
        category: "Networking & Architecture",
        mnemonic: "ALB = El conserje inteligente que lee la etiqueta del sobre y lo mete en el buzón correcto."
      }
    ]
  },
  15: {
    title: "Bloque 15 (Q351 - Q375): Integración de Eventos sin Código, SaaS Multi-Tenant & Replicación S3",
    patterns: [
      {
        trigger: "Conectar una cola SQS con una función Lambda aplicando filtrado y transformación previa sin escribir código pegamento",
        optimalService: "Amazon EventBridge Pipes (con filtro incorporado y enriquecimiento)",
        discardPattern: "Descartar Lambda intermediaria únicamente para filtrar mensajes irrelevantes (gasto innecesario de invocaciones).",
        category: "Event-Driven Architecture",
        mnemonic: "EventBridge Pipes = Tubería directa entre origen y destino que filtra las impurezas por el camino."
      },
      {
        trigger: "Replicar objetos S3 a otra cuenta y región asegurando que la cuenta de destino sea la dueña de los objetos",
        optimalService: "S3 Cross-Region Replication (CRR) con KMS CMK y opción 'Owner Override' (cambio de titularidad)",
        discardPattern: "Descartar scripts de sincronización periódica con AWS CLI S3 sync (lento, no captura eliminaciones ni es continuo).",
        category: "Storage & Compliance",
        mnemonic: "Owner Override = El paquete cambia de propietario legal en cuanto cruza la frontera de la cuenta."
      },
      {
        trigger: "Ofrecer una API interna de una empresa a cientos de clientes corporativos en AWS sin colisión de direcciones IP",
        optimalService: "AWS PrivateLink con un Network Load Balancer (NLB) como origen",
        discardPattern: "Descartar VPC Peering (el solapamiento de rangos CIDR 10.0.0.0/16 bloquea la interconexión).",
        category: "Multi-Tenant Networking",
        mnemonic: "PrivateLink = Cada cliente ve una IP de su propia casa para hablar contigo. Da igual que todos usen 10.0.0.0/16."
      }
    ]
  },
  16: {
    title: "Bloque 16 (Q376 - Q400): Gobernanza de Costes, Rotación de Secretos & Cumplimiento Normativo",
    patterns: [
      {
        trigger: "Hacer cumplir el etiquetado obligatorio (Cost Allocation Tags) en todas las cuentas de la organización",
        optimalService: "AWS Organizations Tag Policies + AWS Config rules",
        discardPattern: "Descartar confiar en la buena voluntad de los desarrolladores o revisiones manuales en Excel a fin de mes.",
        category: "Governance & FinOps",
        mnemonic: "Tag Policy = Si el recurso no lleva la etiqueta 'CentroDeCoste', no se puede crear."
      },
      {
        trigger: "Rotar contraseñas de bases de datos críticas cada 30 días de forma transparente y sin caída",
        optimalService: "AWS Secrets Manager con función Lambda de rotación automática para RDS",
        discardPattern: "Descartar AWS Systems Manager Parameter Store (Parameter Store almacena configuración, pero no incluye motor de rotación automática nativo).",
        category: "Security & Automation",
        mnemonic: "Secrets Manager = El cerrajero automático que cambia la cerradura y le pasa la nueva llave a la app sin despertarte."
      },
      {
        trigger: "Almacenar datos con requerimientos regulatorios de 'Write Once, Read Many' (WORM) inalterables incluso por el admin",
        optimalService: "S3 Object Lock en Modo Compliance",
        discardPattern: "Descartar S3 Object Lock en Modo Governance (el modo Governance permite que usuarios con permisos especiales eliminen el bloqueo).",
        category: "Storage Compliance",
        mnemonic: "Compliance Mode = Ni el Director de Seguridad ni el CEO pueden borrar el archivo antes de que expire el plazo."
      }
    ]
  },
  17: {
    title: "Bloque 17 (Q401 - Q411): Autenticación de Usuarios Legacy, Cero Código & Seguridad Perimetral",
    patterns: [
      {
        trigger: "Proteger una aplicación web en Fargate/ECS con autenticación multifactor (MFA) sin modificar el código de la aplicación",
        optimalService: "Application Load Balancer (ALB) con regla de autenticación integrada con Amazon Cognito User Pool Hosted UI",
        discardPattern: "Descartar modificar el contenedor para meter librerías de autenticación o usar políticas IAM directas en ECS.",
        category: "Identity & Containers",
        mnemonic: "ALB + Cognito = La recepción del edificio pide el DNI y el código SMS antes de dejar entrar a la oficina."
      },
      {
        trigger: "Comunicación de Lambdas dentro de una VPC con DynamoDB y S3 sin pagar por NAT Gateway ni salir a Internet",
        optimalService: "VPC Gateway Endpoints para S3 y DynamoDB (gratuitos)",
        discardPattern: "Descartar NAT Gateway o Interface Endpoints si se busca coste cero y máxima velocidad.",
        category: "Serverless Networking",
        mnemonic: "Gateway Endpoints = Las dos únicas puertas secretas gratuitas de AWS en la tabla de rutas para S3 y DynamoDB."
      },
      {
        trigger: "Detección inteligente de amenazas de seguridad y accesos no autorizados a nivel de cuenta",
        optimalService: "Amazon GuardDuty (analiza VPC Flow Logs, CloudTrail y DNS Logs con Machine Learning)",
        discardPattern: "Descartar revisar manualmente millones de líneas de logs en CloudWatch.",
        category: "Threat Detection",
        mnemonic: "GuardDuty = El perro guardián que vigila silenciosamente el perímetro 24/7."
      }
    ]
  }
};

/**
 * Busca de forma inteligente y semántica el patrón Repemill más relevante para una pregunta específica.
 * Realiza evaluación contextual cruzada con detección de pares arquitectónicos críticos.
 */
function findBestPatternForQuestion(question) {
  if (!question) return null;
  const blockNum = question.blockNumber || 1;
  const localPatterns = (REPEMILL_DATA[blockNum] && REPEMILL_DATA[blockNum].patterns) || [];

  // Recopilar todos los patrones del Repemill con su bloque de origen
  const allPatterns = [];
  for (const b in REPEMILL_DATA) {
    for (const p of REPEMILL_DATA[b].patterns) {
      allPatterns.push({ ...p, sourceBlock: parseInt(b) });
    }
  }

  const qText = ((question.question || "") + " " + Object.values(question.choices || {}).join(" ")).toLowerCase();

  // Función de puntuación semántica de alta precisión
  function evaluatePattern(p) {
    let score = 0;
    const triggerLower = p.trigger.toLowerCase();
    const optimalLower = p.optimalService.toLowerCase();
    const discardLower = (p.discardPattern || "").toLowerCase();
    const combined = triggerLower + " " + optimalLower + " " + discardLower;

    // 1. Coincidencias de pares técnicos clave de alta discriminación (+20 puntos)
    const architecturalPairs = [
      { terms: ["direct connect gateway", "dxgw"] },
      { terms: ["fsx for lustre", "lustre"] },
      { terms: ["iam identity center", "single sign-on", "aws sso"] },
      { terms: ["scim", "scim v2.0", "provisioning"] },
      { terms: ["active directory", "ad connector", "aws managed microsoft ad"] },
      { terms: ["rekognition"] },
      { terms: ["network load balancer", "nlb", "tcp on a static port", "fixed address assignments", "allow list", "allow lists"] },
      { terms: ["association authorization", "createvpcassociationauthorization", "associatevpcwithhostedzone"] },
      { terms: ["transit gateway", "tgw"] },
      { terms: ["inbound resolver", "inbound endpoint"] },
      { terms: ["outbound resolver", "outbound endpoint"] },
      { terms: ["aurora global database"] },
      { terms: ["dynamodb global tables", "global table"] },
      { terms: ["vault lock", "compliance mode"] },
      { terms: ["intelligent-tiering"] },
      { terms: ["eventbridge"] },
      { terms: ["privatelink", "interface vpc endpoint", "endpoint service"] },
      { terms: ["macie", "pii"] },
      { terms: ["guardduty"] },
      { terms: ["step functions"] },
      { terms: ["kinesis data firehose", "firehose"] },
      { terms: ["kinesis data streams"] },
      { terms: ["transfer family", "sftp"] },
      { terms: ["s3 event notification", "s3 event notifications"] },
      { terms: ["elasticache", "redis", "memcached"] },
      { terms: ["saml 2.0", "saml", "idp", "assumerolewithsaml", "federated identity"] }
    ];

    for (const pair of architecturalPairs) {
      const inPattern = pair.terms.some(t => combined.includes(t));
      const inQuestion = pair.terms.some(t => qText.includes(t));
      if (inPattern && inQuestion) {
        score += 20;
      }
    }

    // 2. Coincidencias de servicios AWS (+6 puntos)
    const services = [
      "route 53", "transit gateway", "direct connect", "privatelink", "aurora",
      "dynamodb", "sqs", "sns", "kinesis", "step functions", "lambda", "ecs",
      "fargate", "s3", "macie", "guardduty", "secrets manager", "kms",
      "systems manager", "config", "control tower", "transfer family", "storage gateway",
      "waf", "shield", "opensearch", "cloudwatch", "organizations", "scp",
      "elasticache", "alb", "nlb", "fsx", "backup", "elastic beanstalk"
    ];
    for (const s of services) {
      if (optimalLower.includes(s) && qText.includes(s)) {
        score += 6;
      }
    }

    // 3. Coincidencias de términos discriminadores del trigger (+3 puntos)
    const triggerWords = triggerLower
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !["para", "with", "from", "that", "this", "este", "esta", "como", "sobre", "entre", "cuenta", "solucion"].includes(w));

    for (const tw of triggerWords) {
      if (qText.includes(tw)) {
        score += 2;
      }
    }

    // Bonificación de afinidad local por pertenecer al bloque actual
    if (p.sourceBlock === blockNum) {
      score += 5;
    }

    return score;
  }

  let bestPattern = localPatterns[0] || allPatterns[0];
  let highestScore = -1;

  for (const p of allPatterns) {
    const score = evaluatePattern(p);
    if (score > highestScore) {
      highestScore = score;
      bestPattern = p;
    }
  }

  return bestPattern;
}

if (typeof window !== 'undefined') {
  window.findBestPatternForQuestion = findBestPatternForQuestion;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REPEMILL_DATA, findBestPatternForQuestion };
}

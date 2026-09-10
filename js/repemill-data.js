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


// =========================================================================
// CATÁLOGO DE ARQUETIPOS Y COMPONENTES AWS (DECISION ENGINE REPEMILL)
// =========================================================================

const AWS_COMPONENTS = [
  {
    id: "secrets-manager",
    name: "AWS Secrets Manager",
    category: "Seguridad & Cifrado",
    keywords: ["secrets manager", "secret manager", "rotationschedule", "rotate credentials", "rotation schedule", "rotate password", "database credentials"],
    archetype: "Gestión y rotación automática de secretos con integración directa a bases de datos",
    winningPattern: {
      trigger: "Rotación periódica automática de contraseñas de base de datos (cada 30/60/90 días) con mínimo esfuerzo operacional ('least operational overhead') o integración nativa con RDS/Redshift/DocumentDB.",
      whyWins: "Provee el recurso nativo RotationSchedule en CloudFormation y funciones Lambda automáticas preconstruidas sin requerir disparadores externos ni lógica a medida.",
      ruleOfThumb: "Si el enunciado exige rotación automatizada de contraseñas de BD con mínimo overhead operacional -> Secrets Manager es la respuesta correcta."
    },
    discardPattern: {
      antiPattern: "Usar Parameter Store para rotación automatizada sin overhead, o almacenar credenciales dinámicas en S3 cifrado.",
      whyDiscard: "Parameter Store NO dispone de programador de rotación nativo out-of-the-box; requeriría crear reglas de EventBridge + Lambdas personalizadas + gestión manual de versiones.",
      quickDiscard: "Descarta Parameter Store si piden rotar credenciales sin sobrecarga operativa. Descarta KMS si sugieren que KMS 'almacena' cadenas de contraseñas."
    },
    duel: {
      targetId: "ssm-parameter-store",
      vs: "Secrets Manager vs Systems Manager Parameter Store",
      distinction: "Secrets Manager ($0.40/secreto) incluye rotación nativa integrada (RotationSchedule para RDS). Parameter Store (gratuito nivel estándar) es para configuración y cadenas SecureString estáticas sin programador de rotación nativo."
    }
  },
  {
    id: "ssm-parameter-store",
    name: "AWS Systems Manager Parameter Store",
    category: "Seguridad & Configuración",
    keywords: ["parameter store", "systems manager parameter", "ssm parameter", "securestring", "hierarchical configuration"],
    archetype: "Almacén jerárquico de parámetros de configuración y cadenas seguras a bajo coste",
    winningPattern: {
      trigger: "Almacenar parámetros de configuración jerárquicos de aplicaciones, licencias, URLs y valores cifrados (SecureString) con control de versiones granular y a coste mínimo/cero.",
      whyWins: "Sin coste adicional para parámetros estándar, integración nativa con IAM y ECS/Lambda para inyectar variables de entorno de configuración.",
      ruleOfThumb: "Si piden almacenar variables de configuración o secretos estáticos sin rotación programada minimizando costes -> Parameter Store."
    },
    discardPattern: {
      antiPattern: "Usar Parameter Store cuando el requisito explícito es 'rotar automáticamente contraseñas de base de datos cada N días sin desarrollo adicional'.",
      whyDiscard: "No tiene recurso RotationSchedule nativo ni plantillas de rotación integradas en CloudFormation como Secrets Manager.",
      quickDiscard: "Descarta Parameter Store si piden rotación de credenciales con 'least operational overhead'."
    },
    duel: {
      targetId: "secrets-manager",
      vs: "Parameter Store vs Secrets Manager",
      distinction: "Parameter Store es para parámetros jerárquicos y cadenas fijas a coste cero; Secrets Manager es el servicio especializado con rotación nativa periódica para bases de datos."
    }
  },
  {
    id: "api-gateway",
    name: "Amazon API Gateway",
    category: "Integración de Aplicaciones",
    keywords: ["api gateway", "rest api", "http api", "aws integration", "mock integration", "usage plans", "api key", "request validation"],
    archetype: "Punto de entrada de APIs serverless públicas/privadas con throttling, autorización y transformaciones",
    winningPattern: {
      trigger: "Crear una API REST/HTTP serverless accesible públicamente sobre HTTPS con escalado automático, autorización (Cognito/Lambda Authorizer) y opcionalmente integración directa con servicios AWS (DynamoDB, SQS, Kinesis) sin Lambda intermediaria.",
      whyWins: "Soporta integración nativa 'AWS Integration' para invocar DynamoDB o SQS directamente con plantillas de mapeo VTL, reduciendo latencia y coste al eliminar la función Lambda puente.",
      ruleOfThumb: "Para una API serverless HTTPS escalable con DynamoDB, API Gateway con integración directa AWS o Lambda es el patrón estándar de AWS."
    },
    discardPattern: {
      antiPattern: "Usar Global Accelerator directamente con Lambda@Edge (incompatible) o usar NLB cuando se requiere enrutamiento HTTP avanzado o autenticación Cognito/API Keys.",
      whyDiscard: "Global Accelerator no soporta Lambda@Edge directamente; NLB opera en Capa 4 y no valida peticiones HTTP ni gestiona planes de uso.",
      quickDiscard: "Descarta NLB si piden autenticación JWT/Cognito nativa en la API o integración directa con DynamoDB."
    },
    duel: {
      targetId: "alb",
      vs: "API Gateway vs Application Load Balancer",
      distinction: "API Gateway está optimizado para microservicios serverless, planes de uso, API keys, throttling por cliente y transformaciones VTL. ALB está optimizado para alto volumen HTTP continuo sobre contenedores/EC2 con menor coste por millón de peticiones."
    }
  },
  {
    id: "lambda",
    name: "AWS Lambda",
    category: "Cómputo Serverless",
    keywords: ["lambda", "serverless compute", "lambda function", "event-driven", "concurrency limit", "provisioned concurrency"],
    archetype: "Cómputo serverless orientado a eventos sin aprovisionamiento de servidores",
    winningPattern: {
      trigger: "Procesamiento reactivo impulsado por eventos (S3 uploads, DynamoDB Streams, peticiones API Gateway, mensajes SQS) con ejecución menor a 15 minutos y cero coste cuando está inactivo.",
      whyWins: "Escalado automático instantáneo por petición, facturación por milisegundo y cero administración de sistemas operativos o parches.",
      ruleOfThumb: "Si la carga es intermitente, orientada a eventos y dura < 15 minutos -> Lambda es la opción serverless por excelencia."
    },
    discardPattern: {
      antiPattern: "Usar Lambda para procesos continuos de más de 15 minutos, procesamiento gráfico de alta intensidad sostenida, o sockets TCP raw en Capa 4.",
      whyDiscard: "Límite duro de tiempo de ejecución de 900 segundos (15 min) y límites de memoria de 10 GB.",
      quickDiscard: "Descarta Lambda si la tarea tarda más de 15 minutos o requiere acceso root al hipervisor o sockets TCP continuos."
    },
    duel: {
      targetId: "ecs-fargate",
      vs: "Lambda vs AWS Fargate",
      distinction: "Lambda para tareas efímeras event-driven (< 15 min, arranques milimétricos). Fargate para contenedores de larga duración sostenida sin límite de tiempo y con control completo sobre el entorno del contenedor."
    }
  },
  {
    id: "dynamodb",
    name: "Amazon DynamoDB & Global Tables",
    category: "Bases de Datos & NoSQL",
    keywords: ["dynamodb", "global tables", "global table", "single-digit millisecond", "nosql", "dynamodb streams", "dax", "ttl"],
    archetype: "Base de datos NoSQL clave-valor totalmente gestionada con latencia de un dígito de milisegundo y replicación multi-activa global",
    winningPattern: {
      trigger: "Almacenamiento NoSQL masivo con acceso por clave primaria, latencia ultra-baja (< 10 ms), escalado automático masivo y/o replicación multi-región activa-activa ('Global Tables').",
      whyWins: "Global Tables proporciona replicación multi-maestro totalmente gestionada entre regiones de AWS en menos de 1 segundo sin impacto en la aplicación.",
      ruleOfThumb: "Si piden latencia de milisegundo único, esquema flexible y multi-región activo-activo sin gestionar clústeres -> DynamoDB Global Tables."
    },
    discardPattern: {
      antiPattern: "Usar DynamoDB para consultas relacionales complejas con JOINs múltiples, transacciones multi-tabla complejas entre decenas de entidades, o agregaciones OLAP masivas.",
      whyDiscard: "DynamoDB no soporta JOINs relacionales ni consultas SQL analíticas profundas ad-hoc.",
      quickDiscard: "Descarta DynamoDB si el requerimiento pide compatibilidad MySQL/PostgreSQL nativa o consultas complejas con JOINs."
    },
    duel: {
      targetId: "aurora",
      vs: "DynamoDB Global Tables vs Aurora Global Database",
      distinction: "DynamoDB es NoSQL multi-activo (escritura en cualquier región). Aurora Global Database es relacional SQL (un solo clúster primario de escritura y réplicas de lectura secundarias en otras regiones con RPO < 1s)."
    }
  },
  {
    id: "aurora",
    name: "Amazon Aurora & Aurora Global Database",
    category: "Bases de Datos Relacionales",
    keywords: ["aurora", "aurora global", "aurora global database", "aurora serverless", "aurora replica", "storage replication", "mysql compatible", "postgresql compatible"],
    archetype: "Motor relacional de alto rendimiento compatible con MySQL/PostgreSQL con replicación en disco de 6 vías y expansión global",
    winningPattern: {
      trigger: "Base de datos relacional (SQL) transaccional ACID de alta disponibilidad con failover en < 30 segundos, replicación entre regiones con RPO < 1 segundo (Aurora Global Database) y escalado de réplicas lectoras automáticas.",
      whyWins: "Capa de almacenamiento distribuida que replica automáticamente los datos en 6 copias a través de 3 AZs a nivel de almacenamiento físico, desacoplando cómputo y disco.",
      ruleOfThumb: "Base de datos relacional corporativa con requisitos de DR multi-región con RPO < 1 seg y RTO < 1 min -> Aurora Global Database."
    },
    discardPattern: {
      antiPattern: "Usar réplicas estándar de RDS con replicación binaria tradicional cuando se exige RPO de milisegundos entre regiones, o intentar configurar múltiples 'escritores' simultáneos en Aurora estándar en varias regiones.",
      whyDiscard: "Las réplicas binarias de RDS sufren de lag de replicación mayor bajo carga pesada en comparación con la replicación a nivel de almacenamiento de Aurora.",
      quickDiscard: "Descarta RDS tradicional si el examen especifica 'RPO menor a 1 segundo en failover cross-region'."
    },
    duel: {
      targetId: "rds",
      vs: "Aurora Global Database vs RDS Cross-Region Replicas",
      distinction: "Aurora Global replica directamente a nivel de bloques de almacenamiento con latencia < 1s sin sobrecargar el motor de base de datos. RDS tradicional usa replicación lógica binaria con mayor lag."
    }
  },
  {
    id: "rds",
    name: "Amazon RDS (Multi-AZ & Read Replicas)",
    category: "Bases de Datos Relacionales",
    keywords: ["rds", "multi-az", "read replica", "rds mysql", "rds postgresql", "rds sql server", "rds oracle", "rds proxy"],
    archetype: "Servicio de bases de datos relacionales gestionado tradicional con soporte Multi-AZ síncrono",
    winningPattern: {
      trigger: "Bases de datos comerciales (Oracle, SQL Server) o de código abierto estándar donde se busca HA en la misma región con conmutación por error síncrona sin intervención (Multi-AZ standby).",
      whyWins: "Multi-AZ proporciona replicación síncrona a nivel de volumen a una réplica pasiva en otra AZ para failover automático en minutos ante fallo de hardware.",
      ruleOfThumb: "Para alta disponibilidad en la misma región con bases de datos estándar -> RDS Multi-AZ. Para descargar lectura -> RDS Read Replicas."
    },
    discardPattern: {
      antiPattern: "Usar Multi-AZ para mejorar el rendimiento de lectura (el nodo standby no atiende lecturas en RDS estándar), o usar réplicas síncronas entre distintas regiones (Multi-AZ es estrictamente intra-región).",
      whyDiscard: "El nodo secundario Multi-AZ es un standby pasivo que no acepta tráfico SQL de clientes.",
      quickDiscard: "Descarta Multi-AZ si el objetivo es distribuir o escalar tráfico de lectura; para eso son las Read Replicas."
    },
    duel: {
      targetId: "aurora",
      vs: "RDS Multi-AZ vs Aurora Multi-AZ",
      distinction: "En RDS Multi-AZ el nodo secundario es pasivo y no recibe tráfico. En Aurora, todas las réplicas lectoras secundarias pueden atender lecturas simultáneamente mientras actúan como objetivos de conmutación por error."
    }
  },
  {
    id: "elasticache",
    name: "Amazon ElastiCache (Redis vs Memcached)",
    category: "Bases de Datos & Caché",
    keywords: ["elasticache", "redis", "memcached", "in-memory cache", "session cache", "sub-millisecond latency", "read-heavy"],
    archetype: "Almacén de datos en memoria ultra-rápido para caché de consultas y sesiones de usuario con latencia sub-milisegundo",
    winningPattern: {
      trigger: "Descargar bases de datos relacionales saturadas por consultas repetitivas de lectura (Read-Heavy) o gestionar sesiones HTTP distribuidas con latencia menor a 1 milisegundo.",
      whyWins: "Almacenamiento en RAM que elimina por completo el acceso a disco en lecturas repetitivas.",
      ruleOfThumb: "Redis para estructuras de datos complejas, persistencia, clúster y failover automático. Memcached para caché multihilo simple sin persistencia."
    },
    discardPattern: {
      antiPattern: "Elegir Memcached cuando se requiere alta disponibilidad con conmutación por error automática, persistencia en disco o réplicas de lectura.",
      whyDiscard: "Memcached no soporta replicación ni persistencia ni failover Multi-AZ; si un nodo cae, sus datos se pierden.",
      quickDiscard: "Descarta Memcached si la pregunta menciona: Multi-AZ, persistencia, pub/sub, geo-replicación o estructuras complejas (sets, hashes)."
    },
    duel: {
      targetId: "dynamodb",
      vs: "ElastiCache Redis vs DynamoDB Accelerator (DAX)",
      distinction: "DAX es una caché específica integrada nativa en DynamoDB sin cambios de código. ElastiCache es una caché de propósito general para RDS, Aurora o aplicaciones desacopladas."
    }
  },
  {
    id: "transit-gateway",
    name: "AWS Transit Gateway (TGW)",
    category: "Redes & Conectividad",
    keywords: ["transit gateway", "tgw", "hub and spoke", "transit gateway peering", "multicast", "inter-region peering", "centralized network"],
    archetype: "Concentrador central de red (Hub-and-Spoke) para interconectar cientos de VPCs, Direct Connect y VPNs",
    winningPattern: {
      trigger: "Interconectar decenas o cientos de VPCs entre sí, junto con conexiones locales (Direct Connect / VPN) y múltiples regiones, con topología centralizada y control granular mediante tablas de enrutamiento.",
      whyWins: "Soporta enrutamiento transitivo completo, eliminando la explosión cuadrática de pares de VPC Peering y simplificando la seguridad perimetral compartida.",
      ruleOfThumb: "Si el diseño involucra más de 10 VPCs interconectadas, topología hub-and-spoke o interconexión con Direct Connect Gateway -> Transit Gateway."
    },
    discardPattern: {
      antiPattern: "Usar VPC Peering completo entre 50 VPCs (requeriría 1225 enlaces individuales sin transitividad) o desplegar appliances EC2 VPN auto-gestionados para conectar VPCs.",
      whyDiscard: "VPC Peering no admite enrutamiento transitivo (A no puede hablar con C a través de B).",
      quickDiscard: "Descarta VPC Peering si la solución requiere que el tráfico salte a través de una VPC intermedia (transitive routing)."
    },
    duel: {
      targetId: "privatelink",
      vs: "Transit Gateway vs AWS PrivateLink",
      distinction: "Transit Gateway conecta redes completas (rutas IP bidireccionales completas entre VPCs). PrivateLink conecta un servicio específico de forma unidireccional sin unir las redes ni exponer rangos CIDR."
    }
  },
  {
    id: "direct-connect",
    name: "AWS Direct Connect & Direct Connect Gateway",
    category: "Redes Híbridas",
    keywords: ["direct connect", "dx", "direct connect gateway", "dxgw", "dedicated connection", "hosted connection", "macsec", "consistent network latency"],
    archetype: "Conexión física de fibra dedicada entre instalaciones locales y la nube de AWS con ancho de banda y latencia garantizados",
    winningPattern: {
      trigger: "Requisitos de conectividad privada corporativa de alto rendimiento, ancho de banda garantizado (1G/10G/100G), latencia predecible y reducción de costes de transferencia de datos frente a Internet.",
      whyWins: "Elude la red pública de Internet por completo mediante un cable físico dedicado. Direct Connect Gateway permite acceder a VPCs en cualquier región de AWS desde una sola conexión física.",
      ruleOfThumb: "Si piden latencia consistente, transferencia masiva privada y alta fiabilidad sin pasar por la Internet pública -> Direct Connect con Direct Connect Gateway."
    },
    discardPattern: {
      antiPattern: "Usar Site-to-Site VPN cuando se requiere ancho de banda predecible de varios Gbps sin fluctuaciones de jitter o latencia pública.",
      whyDiscard: "Las VPN por Internet están sujetas a variaciones de congestión de proveedores y limitadas a 1.25 Gbps por túnel IPsec.",
      quickDiscard: "Descarta VPN sobre Internet si el enunciado exige 'consistent network performance' o 'predictable low latency'."
    },
    duel: {
      targetId: "transit-gateway",
      vs: "Direct Connect Gateway vs Transit VIF",
      distinction: "DX Gateway con Private VIFs conecta a VPCs directamente (hasta 10 VPCs). Para conectar DX a un Transit Gateway y escalar a miles de VPCs, se requiere un Transit VIF."
    }
  },
  {
    id: "privatelink",
    name: "AWS PrivateLink / VPC Interface Endpoints",
    category: "Redes & Seguridad",
    keywords: ["privatelink", "interface endpoint", "vpc endpoint", "endpoint service", "network load balancer privatelink", "overlapping cidr"],
    archetype: "Conectividad privada segura y unidireccional a servicios AWS o SaaS entre VPCs sin exponer IPs públicas ni requerir VPC Peering",
    winningPattern: {
      trigger: "Consumir servicios de terceros o exponer un servicio interno a otras cuentas/VPCs privadas sin configurar VPC Peering, sin enrutamiento de red completo y resolviendo conflictos de rangos CIDR solapados.",
      whyWins: "Crea una interfaz de red elástica (ENI) con IP privada local en la VPC del consumidor, conectándose tras bambalinas a un NLB en la VPC del proveedor.",
      ruleOfThumb: "Si se deben conectar servicios entre VPCs con rangos de IP solapados (overlapping CIDRs) o sin exponer la red interna -> PrivateLink (Interface Endpoint)."
    },
    discardPattern: {
      antiPattern: "Usar VPC Peering cuando las dos VPCs tienen el mismo bloque CIDR (ej. ambas son 10.0.0.0/16) o abrir tráfico a través de Internet Gateways con IPs públicas elásticas.",
      whyDiscard: "VPC Peering es estrictamente incompatible si los bloques de direcciones IP coinciden o se solapan.",
      quickDiscard: "Descarta VPC Peering si el problema menciona 'overlapping IP addresses' o 'overlapping CIDR blocks'."
    },
    duel: {
      targetId: "transit-gateway",
      vs: "PrivateLink vs VPC Peering / Transit Gateway",
      distinction: "VPC Peering/TGW conectan subredes completas con enrutamiento bidireccional IP. PrivateLink solo publica un puerto de servicio específico unidireccional a través de un NLB."
    }
  },
  {
    id: "route53-resolver",
    name: "Route 53 Resolver (Inbound vs Outbound)",
    category: "Redes & DNS Híbrido",
    keywords: ["route 53 resolver", "inbound resolver", "inbound endpoint", "outbound resolver", "outbound endpoint", "resolver rule", "conditional forwarder", "hybrid dns"],
    archetype: "Puente DNS híbrido condicional entre el centro de datos local y las zonas privadas de AWS Route 53",
    winningPattern: {
      trigger: "Resolución DNS híbrida: Servidores on-premises necesitan resolver nombres de una Private Hosted Zone en AWS (Inbound Resolver), o instancias EC2 en VPC necesitan resolver nombres de dominio locales corporativos (Outbound Resolver).",
      whyWins: "Servicio serverless totalmente gestionado por AWS con alta disponibilidad nativa, eliminando servidores DNS BIND intermedios autogestionados en EC2.",
      ruleOfThumb: "De On-Prem hacia AWS -> Inbound Resolver Endpoint. De AWS hacia On-Prem -> Outbound Resolver Endpoint + Resolver Rule (Forwarder)."
    },
    discardPattern: {
      antiPattern: "Desplegar servidores EC2 con BIND o Windows Server DNS como reenviadores manuales cuando se busca minimizar la sobrecarga operativa.",
      whyDiscard: "Las instancias EC2 autogestionadas requieren parches, mantenimiento de HA, clustering y escalado manual.",
      quickDiscard: "Descarta Outbound Resolver si las consultas vienen desde on-premise hacia AWS (eso es Inbound). Descarta EC2 DNS Forwarders por sobrecarga operativa."
    },
    duel: {
      targetId: "alb",
      vs: "Inbound Resolver vs Outbound Resolver",
      distinction: "Inbound = Entrada de consultas DNS desde el exterior hacia Route 53. Outbound = Salida de consultas DNS desde VPC hacia servidores locales externos."
    }
  },
  {
    id: "alb",
    name: "Application Load Balancer (ALB)",
    category: "Redes & Balanceo de Carga",
    keywords: ["application load balancer", "alb", "layer 7", "path-based routing", "host-based routing", "oidc", "cognito authentication", "sticky sessions", "http https"],
    archetype: "Balanceador de carga de Capa 7 para aplicaciones HTTP/HTTPS con enrutamiento avanzado, integración OIDC/Cognito y TLS offloading",
    winningPattern: {
      trigger: "Distribución de tráfico HTTP/HTTPS con enrutamiento basado en rutas (/api, /img), basado en host (dominio.com), terminación TLS con múltiples certificados SNI, autenticación de usuarios mediante Cognito/OIDC y sesiones persistentes (sticky cookies).",
      whyWins: "Inspección inteligente a nivel de aplicación (Capa 7) que permite balancear a múltiples target groups de ECS/EC2 o Lambdas según cabeceras y paths.",
      ruleOfThumb: "Tráfico web HTTP/HTTPS con necesidad de microservicios por ruta, autenticación integrada o cookies -> ALB."
    },
    discardPattern: {
      antiPattern: "Usar ALB para tráfico TCP/UDP raw sin HTTP, o cuando los clientes requieren IPs elásticas fijas/estáticas para incluir en listas blancas de cortafuegos.",
      whyDiscard: "ALB utiliza IPs dinámicas cambiantes; no proporciona una dirección IP estática pública inmutable.",
      quickDiscard: "Descarta ALB si los clientes exigen 'static IP addresses' o 'whitelisting a fixed IP' (para eso es NLB o Global Accelerator)."
    },
    duel: {
      targetId: "nlb",
      vs: "Application Load Balancer (ALB) vs Network Load Balancer (NLB)",
      distinction: "ALB opera en Capa 7 (HTTP/HTTPS, rutas, autenticación OIDC, IPs dinámicas). NLB opera en Capa 4 (TCP/UDP, millones de req/s, latencia de microsegundos, IPs elásticas fijas por AZ)."
    }
  },
  {
    id: "nlb",
    name: "Network Load Balancer (NLB)",
    category: "Redes & Balanceo de Carga",
    keywords: ["network load balancer", "nlb", "layer 4", "static ip", "elastic ip", "ultra-low latency", "millions of requests", "tcp", "udp", "tls termination"],
    archetype: "Balanceador de carga de Capa 4 de ultra-alto rendimiento y latencia ultrabaja con soporte de direcciones IP fijas por AZ",
    winningPattern: {
      trigger: "Protocolos no HTTP (TCP, UDP, TLS), millones de peticiones por segundo con picos instantáneos sin pre-warming, latencia de microsegundos, o requisito de proveer direcciones IP públicas fijas/estáticas para listas blancas de cortafuegos.",
      whyWins: "Capaz de gestionar millones de conexiones concurrentes a nivel de transporte sin degradación, y se integra nativamente como target de AWS PrivateLink.",
      ruleOfThumb: "Si piden IP estática para allowlisting en cortafuegos corporativos o latencia ultra-baja en Capa 4 -> NLB."
    },
    discardPattern: {
      antiPattern: "Elegir NLB para enrutar según la ruta URL del navegador (/api, /checkout) o cuando se requiere autenticar usuarios vía Cognito/SAML en el balanceador.",
      whyDiscard: "NLB no inspecciona cabeceras HTTP, URLs ni cookies de aplicación.",
      quickDiscard: "Descarta NLB si se requiere path-based routing o integración directa con Cognito user pools."
    },
    duel: {
      targetId: "alb",
      vs: "NLB vs ALB",
      distinction: "NLB ofrece IP estática y escala instantáneamente a millones de peticiones TCP/UDP sin pre-calentamiento; ALB ofrece enrutamiento inteligente HTTP/HTTPS en Capa 7."
    }
  },
  {
    id: "cloudfront",
    name: "Amazon CloudFront",
    category: "Edge & Distribución de Contenido",
    keywords: ["cloudfront", "cdn", "edge location", "origin access control", "oac", "oai", "signed urls", "signed cookies", "geo-restriction", "field-level encryption"],
    archetype: "Red de distribución de contenidos (CDN) global con almacenamiento en caché perimetral y protección DDoS integrada",
    winningPattern: {
      trigger: "Acelerar la entrega de contenido estático y dinámico globalmente, reducir la carga en el servidor de origen (S3, ALB, EC2), implementar seguridad en el perímetro con AWS WAF y Origin Access Control (OAC).",
      whyWins: "Más de 400 puntos de presencia globales en la red troncal de AWS con caché cercana al usuario y protección DDoS gratuita con AWS Shield Standard.",
      ruleOfThumb: "Acceso global a contenido con baja latencia y descarga de tráfico de S3 -> CloudFront con OAC."
    },
    discardPattern: {
      antiPattern: "Usar S3 Cross-Region Replication para acelerar descargas globales de lectura cuando CloudFront CDN resuelve el problema a una fracción del coste y sin duplicar almacenamiento.",
      whyDiscard: "Duplicar buckets en 15 regiones multiplica el coste de almacenamiento por 15, mientras que CloudFront solo almacena en caché lo que se solicita activamente.",
      quickDiscard: "Descarta replicación multi-región de S3 si el único objetivo es acelerar la entrega de lectura a usuarios mundiales."
    },
    duel: {
      targetId: "global-accelerator",
      vs: "CloudFront vs AWS Global Accelerator",
      distinction: "CloudFront almacena en caché contenido HTTP/HTTPS en ubicaciones perimetrales. Global Accelerator no almacena en caché: enruta tráfico TCP/UDP mediante Anycast IPs fijas a través de la red global de AWS directo al origen."
    }
  },
  {
    id: "cloudfront-functions",
    name: "CloudFront Functions vs Lambda@Edge",
    category: "Edge Computing",
    keywords: ["cloudfront functions", "lambda@edge", "viewer request", "viewer response", "origin request", "origin response", "edge computing", "url rewrite"],
    archetype: "Cómputo ultraligero en el borde para manipulación de cabeceras HTTP y redirecciones a escala masiva",
    winningPattern: {
      trigger: "Manipulación ligera de cabeceras HTTP, normalización de URLs, redirecciones 301/302, validación de tokens de autorización simples con escala de millones de ejecuciones por segundo y mínimo coste.",
      whyWins: "CloudFront Functions se ejecuta en sub-milisegundos en todos los edge locations por 1/6 del precio de Lambda@Edge.",
      ruleOfThumb: "Solo cabeceras HTTP, normalización de URL o redirección simple -> CloudFront Functions. Modificar el cuerpo HTTP, llamadas a red o bibliotecas complejas -> Lambda@Edge."
    },
    discardPattern: {
      antiPattern: "Usar Lambda@Edge para una simple redirección de URL o normalización de cabecera que CloudFront Functions puede hacer mucho más rápido y económico.",
      whyDiscard: "Lambda@Edge es más costoso, tiene mayor latencia de inicio en frío y no se ejecuta en todos los PoPs perimetrales como CloudFront Functions.",
      quickDiscard: "Descarta Lambda@Edge si el requisito no involucra acceder a la red externa ni mutar el body de la petición."
    },
    duel: {
      targetId: "lambda",
      vs: "CloudFront Functions vs Lambda@Edge",
      distinction: "CloudFront Functions: solo eventos Viewer (request/response), JavaScript ES5, sin acceso a red, < 1ms, bajo coste. Lambda@Edge: Node/Python, eventos Origin y Viewer, acceso a red/AWS SDKs, puede modificar bodies."
    }
  },
  {
    id: "global-accelerator",
    name: "AWS Global Accelerator",
    category: "Redes & Aceleración Global",
    keywords: ["global accelerator", "anycast", "static anycast ip", "failover across regions", "non-http traffic", "gaming", "voip", "fast regional failover"],
    archetype: "Servicio de red global que enruta tráfico hacia endpoints óptimos mediante dos IPs Anycast estáticas globales",
    winningPattern: {
      trigger: "Acelerar tráfico no HTTP (o HTTP) que requiere direcciones IP estáticas fijas mundiales, failover instantáneo entre regiones en segundos sin depender de caches DNS (TTL), y protección frente a pérdida de paquetes en la red pública.",
      whyWins: "El tráfico entra a la red troncal privada de AWS en el Edge Location más cercano al cliente y viaja por fibra privada dedicada hasta el recurso de destino.",
      ruleOfThumb: "Dos IPs fijas globales Anycast con conmutación por error entre regiones en segundos -> AWS Global Accelerator."
    },
    discardPattern: {
      antiPattern: "Elegir Route 53 DNS Failover cuando el cliente o los ISPs ignoran los TTLs de DNS o cuando la aplicación no tolera minutos de retraso en la propagación de DNS.",
      whyDiscard: "Los resolvers DNS de clientes a menudo almacenan en caché registros caducados durante horas, impidiendo el failover inmediato.",
      quickDiscard: "Descarta Route 53 Failover si el enunciado requiere 'instant regional failover independent of DNS TTL caching'."
    },
    duel: {
      targetId: "cloudfront",
      vs: "AWS Global Accelerator vs Amazon CloudFront",
      distinction: "Global Accelerator proporciona IPs Anycast estáticas y no hace caché (óptimo para TCP/UDP, VoIP, juegos o failover instantáneo). CloudFront es un CDN que almacena contenido en caché en el borde."
    }
  },
  {
    id: "s3-storage-classes",
    name: "Amazon S3 Storage Classes & Lifecycle",
    category: "Almacenamiento de Objetos",
    keywords: ["s3", "amazon s3", "s3 bucket", "static webpage", "static website hosting", "s3 storage classes", "intelligent-tiering", "s3 standard-ia", "glacier flexible retrieval", "glacier deep archive", "lifecycle policy", "transition rule"],
    archetype: "Jerarquía de niveles de almacenamiento en la nube para optimización radical de costes según frecuencia de acceso",
    winningPattern: {
      trigger: "Reducir costes de almacenamiento en S3 para patrones de acceso desconocidos o variables (Intelligent-Tiering), o archivo a largo plazo que rara vez se consulta (Glacier Flexible / Deep Archive) con políticas de ciclo de vida automáticas.",
      whyWins: "Intelligent-Tiering mueve automáticamente objetos entre niveles sin cargos de recuperación ni impacto operacional. Glacier Deep Archive ofrece el menor coste de la industria ($0.00099/GB/mes).",
      ruleOfThumb: "Patrones de acceso desconocidos o cambiantes -> S3 Intelligent-Tiering. Archivo regulatorio a largo plazo (años) -> Glacier Deep Archive."
    },
    discardPattern: {
      antiPattern: "Mover objetos que se acceden frecuentemente a Glacier o S3 Standard-IA, incurriendo en elevados cargos de recuperación (retrieval fees) y penalizaciones por tamaño mínimo.",
      whyDiscard: "Standard-IA y Glacier cobran por GB recuperado y exigen un mínimo de 128 KB por objeto y 30/90 días de permanencia mínima.",
      quickDiscard: "Descarta Standard-IA si el patrón de acceso es impredecible o si los archivos son pequeños (< 128 KB)."
    },
    duel: {
      targetId: "s3-glacier-vault-lock",
      vs: "S3 Intelligent-Tiering vs S3 Standard-IA",
      distinction: "Intelligent-Tiering tiene una pequeña tarifa de monitorización pero CERO cargos por recuperación. Standard-IA cobra por cada GB recuperado y penaliza si se borra antes de 30 días."
    }
  },
  {
    id: "s3-glacier-vault-lock",
    name: "S3 Object Lock & Glacier Vault Lock",
    category: "Almacenamiento & Cumplimiento",
    keywords: ["object lock", "vault lock", "compliance mode", "governance mode", "worm", "write once read many", "finra", "sec rule 17a-4"],
    archetype: "Modelo WORM (Write Once, Read Many) inmutable e infranqueable incluso para la cuenta root de AWS",
    winningPattern: {
      trigger: "Requisitos de cumplimiento regulatorio financiero/legal estricto (SEC 17a-4, FINRA, HIPAA) que exigen que ningún dato pueda ser modificado o eliminado durante N años, ni siquiera por administradores o la cuenta root.",
      whyWins: "En modo Compliance, la política queda bloqueada criptográficamente y es irrevocable; ninguna llamada a la API (ni de IAM ni de root) puede revocar la retención antes de tiempo.",
      ruleOfThumb: "Retención regulatoria inmutable a prueba de eliminación accidental o maliciosa (WORM) -> S3 Object Lock en Modo Compliance o Glacier Vault Lock."
    },
    discardPattern: {
      antiPattern: "Usar IAM Policies o Bucket Policies estándar de S3 con 'Deny s3:DeleteObject' para cumplir normas WORM.",
      whyDiscard: "Un administrador con privilegios o la cuenta root pueden simplemente modificar o borrar la IAM Policy y proceder a eliminar el objeto.",
      quickDiscard: "Descarta políticas IAM estándar si la pregunta exige que ni siquiera el administrador ni el root puedan eliminar los archivos."
    },
    duel: {
      targetId: "s3-storage-classes",
      vs: "Compliance Mode vs Governance Mode",
      distinction: "Compliance Mode: nadie (ni el root) puede eliminar o acortar la retención. Governance Mode: los usuarios con el permiso especial `s3:BypassGovernanceRetention` pueden anular la protección si es necesario."
    }
  },
  {
    id: "efs",
    name: "Amazon Elastic File System (EFS)",
    category: "Almacenamiento de Archivos",
    keywords: ["efs", "elastic file system", "posix", "nfs", "linux shared storage", "concurrent ec2 mount", "general purpose efs", "max i/o"],
    archetype: "Sistema de archivos elástico y compartido compatible con POSIX/NFSv4 para Linux accesible concurrentemente desde miles de instancias",
    winningPattern: {
      trigger: "Múltiples instancias Linux (EC2, ECS, Lambda) necesitan leer y escribir simultáneamente sobre el mismo sistema de archivos jerárquico compartido a través de múltiples zonas de disponibilidad.",
      whyWins: "Totalmente elástico (crece y decrece automáticamente), almacenamiento nativo multi-AZ y compatibilidad total con permisos POSIX y llamadas al sistema Linux estándar.",
      ruleOfThumb: "Almacenamiento compartido concurrente multi-AZ para servidores web Linux, CMS o repositorios compartidos -> Amazon EFS."
    },
    discardPattern: {
      antiPattern: "Usar Amazon EBS Multi-Attach para un sistema de archivos compartido estándar (EBS Multi-Attach en io1/io2 requiere un cluster file system como GFS2 y solo funciona en una única AZ).",
      whyDiscard: "EBS no es multi-AZ nativo y corromperá los datos si un sistema de archivos estándar de Linux escribe desde varios nodos a la vez.",
      quickDiscard: "Descarta EBS si se requiere acceso compartido concurrente a través de MÚLTIPLES Zonas de Disponibilidad."
    },
    duel: {
      targetId: "fsx-lustre",
      vs: "Amazon EFS vs Amazon FSx for Lustre",
      distinction: "EFS es almacenamiento de propósito general POSIX para Linux. FSx for Lustre está diseñado para computación de alto rendimiento (HPC), machine learning y procesa millones de IOPS con enlace directo a S3."
    }
  },
  {
    id: "fsx-lustre",
    name: "Amazon FSx for Lustre",
    category: "Almacenamiento HPC",
    keywords: ["fsx for lustre", "lustre", "hpc", "high performance computing", "sub-millisecond latency", "hundreds of gigabytes per second", "machine learning storage"],
    archetype: "Sistema de archivos de ultra-alto rendimiento para cargas intensivas de computación científica y ML con sincronización bidireccional a S3",
    winningPattern: {
      trigger: "Cargas de trabajo de cómputo de alto rendimiento (HPC), renderizado visual, genómica, machine learning y procesamiento masivo con miles de núcleos que demandan cientos de GB/s de throughput y millones de IOPS.",
      whyWins: "Carga datos perezosamente directo desde un bucket de S3, los procesa a velocidades de RAM/NVMe locales y exporta los resultados procesados de vuelta a S3 con un solo comando.",
      ruleOfThumb: "Procesamiento HPC, entrenamiento de ML o genómica conectado a S3 -> FSx for Lustre."
    },
    discardPattern: {
      antiPattern: "Usar EFS cuando el requisito exige cientos de GB/s de rendimiento sostenido o integración transparente con objetos en S3 para cómputo masivo.",
      whyDiscard: "EFS tiene límites de throughput y latencia más altos que no alcanzan las exigencias de supercomputación de Lustre.",
      quickDiscard: "Descarta EFS si el enunciado menciona HPC, supercomputación o rendimiento de cientos de gigabytes por segundo."
    },
    duel: {
      targetId: "efs",
      vs: "FSx for Lustre vs Amazon EFS",
      distinction: "FSx for Lustre para HPC/ML con enlace nativo directo a S3 y latencias de microsegundos. EFS para almacenamiento compartido estándar de Linux (WordPress, home directories, CMS)."
    }
  },
  {
    id: "fsx-windows",
    name: "Amazon FSx for Windows File Server",
    category: "Almacenamiento de Archivos",
    keywords: ["fsx for windows", "smb", "active directory integration", "ntfs", "windows shared storage", "shadow copies", "dfs namespaces"],
    archetype: "Almacenamiento de archivos SMB totalmente gestionado y nativo para Windows Server integrado con Microsoft Active Directory",
    winningPattern: {
      trigger: "Compartir archivos nativos de Windows a través del protocolo SMB, soporte de permisos NTFS, integración con AWS Managed Microsoft AD o Active Directory on-premises, y soporte de Instantáneas (Shadow Copies).",
      whyWins: "Construido directamente sobre Windows Server, con total compatibilidad de aplicaciones heredadas de Windows sin cambiar la lógica de permisos.",
      ruleOfThumb: "Cargas de trabajo Windows empresariales, integración SMB/NTFS y Active Directory -> FSx for Windows File Server."
    },
    discardPattern: {
      antiPattern: "Usar EFS para aplicaciones Windows nativas que dependen de SMB o permisos NTFS.",
      whyDiscard: "Amazon EFS utiliza NFSv4 y semántica POSIX de Linux; no es compatible con el protocolo nativo SMB ni con las ACLs de Windows NTFS.",
      quickDiscard: "Descarta EFS si las máquinas cliente son Windows Server y requieren protocolo SMB y permisos NTFS de Active Directory."
    },
    duel: {
      targetId: "efs",
      vs: "FSx for Windows vs Amazon EFS",
      distinction: "FSx for Windows = SMB + NTFS + Active Directory (Windows). EFS = NFSv4 + POSIX (Linux)."
    }
  },
  {
    id: "ebs",
    name: "Amazon Elastic Block Store (EBS)",
    category: "Almacenamiento en Bloque",
    keywords: ["ebs", "gp3", "io2", "io2 block express", "block storage", "elastic block store", "ebs multi-attach", "volume snapshot"],
    archetype: "Volúmenes de almacenamiento en bloque persistentes de alto rendimiento vinculados a una instancia EC2 en una única AZ",
    winningPattern: {
      trigger: "Almacenamiento a nivel de bloque para el sistema operativo o bases de datos autogestionadas en EC2 (SQL Server, Oracle, Cassandra) que requieren decenas de miles de IOPS consistentes (io2 Block Express / gp3).",
      whyWins: "Latencia de milisegundo único acoplada directamente al bus PCIe/red de la instancia, con soporte de snapshots incrementales en S3 y cifrado KMS transparente.",
      ruleOfThumb: "Almacenamiento de disco local dedicado para bases de datos transaccionales en EC2 -> EBS gp3 / io2."
    },
    discardPattern: {
      antiPattern: "Intentar conectar un volumen EBS gp3 normal a múltiples instancias en diferentes zonas de disponibilidad.",
      whyDiscard: "Un volumen EBS reside físicamente dentro de una única Zona de Disponibilidad y no puede montarse a través de fronteras de AZ.",
      quickDiscard: "Descarta EBS si se necesita compartir datos entre varias Zonas de Disponibilidad sin usar replicación a nivel de software."
    },
    duel: {
      targetId: "efs",
      vs: "Amazon EBS vs Amazon EFS",
      distinction: "EBS es almacenamiento en bloque de alta velocidad para una instancia dentro de 1 AZ. EFS es almacenamiento de archivos compartido accesible concurrentemente por miles de instancias a través de múltiples AZs."
    }
  },
  {
    id: "ecs-fargate",
    name: "Amazon ECS & AWS Fargate",
    category: "Cómputo en Contenedores",
    keywords: ["ecs", "fargate", "serverless containers", "amazon ecs", "fargate launch type", "task definition", "microservices container"],
    archetype: "Motor de orquestación de contenedores serverless que elimina la necesidad de aprovisionar y parchear servidores EC2",
    winningPattern: {
      trigger: "Desplegar aplicaciones basadas en contenedores Docker minimizando la sobrecarga operativa de gestión de infraestructura, sin gestionar clústeres EC2, instancias ni parches del kernel.",
      whyWins: "AWS se encarga del aprovisionamiento, escalado, alta disponibilidad y aislamiento del host subyacente a nivel de máquina virtual para cada tarea.",
      ruleOfThumb: "Contenedores Docker con requisito de 'mínima sobrecarga operativa' ('least operational overhead') -> ECS con Fargate."
    },
    discardPattern: {
      antiPattern: "Elegir Amazon EKS o clústeres de EC2 gestionados manualmente cuando la directiva principal de la empresa es reducir la complejidad operativa y no tienen equipo especializado en Kubernetes.",
      whyDiscard: "EKS añade capas de mantenimiento del plano de control, actualizaciones de versiones de Kubernetes, gestión de plugins CNI y configuración de manifiestos YAML complejos.",
      quickDiscard: "Descarta EKS si el enunciado prioriza 'minimal operational overhead' y la aplicación no requiere específicamente APIs de Kubernetes."
    },
    duel: {
      targetId: "eks",
      vs: "Amazon ECS Fargate vs Amazon EKS",
      distinction: "ECS Fargate es la solución serverless de contenedores más simple y directa de AWS. EKS es para orquestación nativa de Kubernetes con portabilidad multinube o herramientas del ecosistema K8s."
    }
  },
  {
    id: "eks",
    name: "Amazon Elastic Kubernetes Service (EKS)",
    category: "Contenedores & Kubernetes",
    keywords: ["eks", "kubernetes", "k8s", "helm", "crd", "daemonset", "container orchestration standard", "hybrid kubernetes"],
    archetype: "Servicio gestionado de Kubernetes para ejecutar clústeres de K8s conformes con la CNCF",
    winningPattern: {
      trigger: "Requisito explícito de utilizar la API estándar de Kubernetes, portabilidad multinube, integración con operadores K8s, herramientas de Helm o compatibilidad con arquitecturas híbridas on-premise existentes.",
      whyWins: "Plano de control de Kubernetes de alta disponibilidad gestionado por AWS con integración nativa con VPC CNI, IAM (IRSA) y balanceadores ALB.",
      ruleOfThumb: "Si el enunciado menciona específicamente Kubernetes, Helm charts, CRDs o portabilidad estándar -> Amazon EKS."
    },
    discardPattern: {
      antiPattern: "Elegir EKS para una arquitectura de microservicios sencilla donde el equipo busca minimizar la gestión y los costes de infraestructura.",
      whyDiscard: "EKS cobra $0.10/hora por clúster solo por el plano de control ($73/mes por clúster) más los costes de nodos, además del esfuerzo de mantenimiento de versiones.",
      quickDiscard: "Descarta EKS si no se menciona Kubernetes y se pide 'least operational overhead' (usa ECS Fargate)."
    },
    duel: {
      targetId: "ecs-fargate",
      vs: "EKS vs ECS",
      distinction: "EKS para Kubernetes estándar y control de manifiestos/ecosistema K8s. ECS para orquestación directa y nativa de AWS con mucha menor complejidad operativa."
    }
  },
  {
    id: "ec2-autoscaling",
    name: "Amazon EC2 Auto Scaling & Spot Fleets",
    category: "Cómputo Elástico",
    keywords: ["ec2 auto scaling", "spot instances", "spot fleet", "target tracking", "step scaling", "mixed instances policy", "fault tolerant batch"],
    archetype: "Ajuste elástico automático de capacidad de cómputo en servidores virtuales EC2 combinando On-Demand y Spot al menor coste",
    winningPattern: {
      trigger: "Cargas de trabajo con fluctuaciones de demanda en máquinas virtuales completas, procesamiento por lotes tolerante a fallos con descuentos de hasta el 90% mediante Instancias Spot, y escalado basado en métricas de CloudWatch.",
      whyWins: "Target Tracking Scaling ajusta automáticamente el número de instancias para mantener una métrica deseada (ej. CPU al 60%), mientras que Mixed Instances Policy combina Spot y On-Demand para resiliencia.",
      ruleOfThumb: "Cargas de trabajo tolerantes a interrupciones y masivas -> Spot Fleet / Spot Instances. Cargas con picos previsibles -> Auto Scaling con Target Tracking."
    },
    discardPattern: {
      antiPattern: "Usar instancias Spot para bases de datos maestras con estado o aplicaciones transaccionales críticas que no toleran interrupciones con preaviso de 2 minutos.",
      whyDiscard: "AWS puede reclamar las instancias Spot en cualquier momento con un aviso de solo 120 segundos cuando la capacidad se agota.",
      quickDiscard: "Descarta Spot Instances para servidores de base de datos transaccionales o tareas con estado no serializadas."
    },
    duel: {
      targetId: "ecs-fargate",
      vs: "EC2 Spot vs On-Demand",
      distinction: "Spot ofrece hasta 90% de descuento para cargas stateless/batch tolerantes a interrupción. On-Demand garantiza disponibilidad ininterrumpida a precio regular."
    }
  },
  {
    id: "organizations-scp",
    name: "AWS Organizations & Service Control Policies (SCPs)",
    category: "Gobernanza & Seguridad Centralizada",
    keywords: ["organizations", "scp", "service control policy", "organizational unit", "guardrails", "deny rule", "root account"],
    archetype: "Guardarraíles de seguridad y límites máximos de permisos centralizados para todas las cuentas de la organización",
    winningPattern: {
      trigger: "Impedir de forma centralizada e inmutable que las cuentas miembro ejecuten ciertas acciones (ej. apagar CloudTrail, crear recursos fuera de regiones aprobadas, o usar tipos de instancias no autorizadas), incluso por el usuario root de la cuenta miembro.",
      whyWins: "Las SCPs actúan como un filtro de permisos máximos: si una SCP tiene un Deny explícito, ninguna IAM Policy dentro de la cuenta miembro podrá otorgar jamás ese permiso.",
      ruleOfThumb: "Restringir permisos globalmente en múltiples cuentas de AWS -> SCPs aplicadas a la raíz o a Unidades Organizativas (OUs)."
    },
    discardPattern: {
      antiPattern: "Pensar que una SCP 'concede' permisos a un usuario, o crear una SCP de Allow sin una IAM Policy correspondiente en la cuenta.",
      whyDiscard: "Las SCPs NO otorgan permisos; solo establecen los límites máximos (guardrails). El usuario aún necesita una política IAM de Allow explícita.",
      quickDiscard: "Descarta SCPs si la pregunta pide otorgar acceso a un rol específico dentro de una cuenta (eso es una IAM Policy)."
    },
    duel: {
      targetId: "iam-identity-center",
      vs: "Service Control Policies (SCPs) vs IAM Policies",
      distinction: "Las SCPs fijan los límites máximos globales sobre las cuentas de AWS (guardarraíles). Las IAM Policies otorgan permisos efectivos a identidades (usuarios, roles) dentro de cada cuenta."
    }
  },
  {
    id: "iam-identity-center",
    name: "AWS IAM Identity Center (AWS Single Sign-On) & SCIM",
    category: "Identidad & Acceso Centralizado",
    keywords: ["iam identity center", "aws sso", "single sign-on", "scim", "saml 2.0", "external idp", "okta", "azure ad", "permission sets"],
    archetype: "Portal centralizado de autenticación única (SSO) y aprovisionamiento automático de identidades corporativas en AWS",
    winningPattern: {
      trigger: "Centralizar el acceso de los empleados a múltiples cuentas de AWS usando sus credenciales corporativas existentes (Azure AD, Okta, Ping, Google), con aprovisionamiento automático de usuarios y grupos vía SCIM v2.0.",
      whyWins: "Asigna 'Permission Sets' centralizados que crean automáticamente roles IAM federados efímeros en las cuentas destino, eliminando la creación de usuarios locales IAM.",
      ruleOfThumb: "Autenticación corporativa unificada en múltiples cuentas con federación externa y SCIM -> AWS IAM Identity Center."
    },
    discardPattern: {
      antiPattern: "Crear usuarios IAM individuales en cada una de las 50 cuentas de AWS con claves de acceso estáticas (overhead insostenible y riesgo de seguridad).",
      whyDiscard: "La gestión descentralizada de credenciales estáticas viola las directrices de seguridad de AWS y dificulta la revocación inmediata de acceso.",
      quickDiscard: "Descarta crear IAM Users locales en cada cuenta si la empresa ya tiene un Identity Provider corporativo."
    },
    duel: {
      targetId: "organizations-scp",
      vs: "IAM Identity Center vs Federación SAML tradicional con IAM Roles",
      distinction: "Identity Center administra los roles y permission sets en todas las cuentas de forma centralizada con soporte SCIM. La federación SAML directa requiere configurar Identity Providers y Roles en cada cuenta individualmente."
    }
  },
  {
    id: "macie",
    name: "Amazon Macie",
    category: "Seguridad & Privacidad de Datos",
    keywords: ["macie", "pii", "personally identifiable information", "sensitive data", "credit card", "passport", "s3 bucket scanning", "data discovery"],
    archetype: "Servicio de seguridad de datos impulsado por ML que descubre, clasifica y protege información confidencial (PII) en Amazon S3",
    winningPattern: {
      trigger: "Identificar y clasificar automáticamente información de identificación personal (PII), números de tarjetas de crédito, pasaportes o credenciales almacenadas sin cifrar en buckets de Amazon S3 a escala masiva.",
      whyWins: "Utiliza modelos de machine learning y coincidencia de patrones para evaluar continuamente la postura de privacidad y alertar vía EventBridge.",
      ruleOfThumb: "Buscar y clasificar datos sensibles o PII en Amazon S3 -> Amazon Macie."
    },
    discardPattern: {
      antiPattern: "Elegir Amazon Inspector o Amazon GuardDuty para encontrar números de tarjeta de crédito dentro de objetos en S3.",
      whyDiscard: "GuardDuty detecta anomalías de comportamiento y ataques a la red; Inspector escanea vulnerabilidades de software CVE en EC2 y contenedores. Ninguno analiza el contenido interno de archivos en S3.",
      quickDiscard: "Descarta Inspector y GuardDuty si el requisito es 'identificar PII o datos sensibles en archivos de S3'."
    },
    duel: {
      targetId: "guardduty",
      vs: "Amazon Macie vs Amazon GuardDuty",
      distinction: "Macie examina el contenido de objetos en S3 para encontrar datos confidenciales (PII). GuardDuty analiza logs de tráfico y eventos para detectar intrusiones y malware."
    }
  },
  {
    id: "guardduty",
    name: "Amazon GuardDuty",
    category: "Seguridad & Detección de Amenazas",
    keywords: ["guardduty", "threat detection", "malware", "crypto mining", "dns logs", "vpc flow logs", "cloudtrail logs", "unauthorized behavior"],
    archetype: "Detección inteligente y continua de amenazas que analiza flujos de red y eventos de AWS con machine learning",
    winningPattern: {
      trigger: "Supervisar y detectar comportamientos sospechosos o maliciosos en la cuenta de AWS (minería de criptomonedas en EC2, llamadas API anómalas, accesos desde IPs maliciosas conocidas, exfiltración DNS).",
      whyWins: "Se activa con un solo clic, no requiere agentes en los servidores y consume directamente los VPC Flow Logs, DNS Logs y CloudTrail sin impactar el rendimiento de la red ni cobrar por los logs.",
      ruleOfThumb: "Detección continua e inteligente de intrusiones y amenazas en la infraestructura AWS sin instalar agentes -> Amazon GuardDuty."
    },
    discardPattern: {
      antiPattern: "Instalar agentes de terceros en todas las EC2 para parsear manualmente los logs de red buscando anomalías.",
      whyDiscard: "Instalar y mantener agentes genera alto overhead operacional, coste computacional y no cubre eventos de la API del plano de control de AWS.",
      quickDiscard: "Descarta soluciones con agentes si se pide 'least operational overhead' para detección de amenazas en AWS."
    },
    duel: {
      targetId: "macie",
      vs: "Amazon GuardDuty vs AWS WAF",
      distinction: "GuardDuty detecta amenazas en el entorno y recursos de AWS analizando logs de red y API. WAF bloquea ataques HTTP en tiempo real a nivel de Capa 7 antes de que lleguen al balanceador."
    }
  },
  {
    id: "kms",
    name: "AWS Key Management Service (KMS)",
    category: "Seguridad & Cifrado",
    keywords: ["kms", "key management service", "cmk", "customer managed key", "envelope encryption", "multi-region key", "key rotation", "key policy", "byok"],
    archetype: "Gestión centralizada de claves criptográficas seguras y cifrado en envoltorio integrado nativamente con todos los servicios AWS",
    winningPattern: {
      trigger: "Cifrado de datos en reposo con claves controladas por el cliente (CMK), control estricto de quién y qué servicio puede descifrar mediante Key Policies, rotación anual automática y claves multi-región para replicación cifrada.",
      whyWins: "Módulos de seguridad de hardware (HSM) certificados FIPS 140-2 Nivel 3 y auditoría exhaustiva de cada uso de clave a través de CloudTrail.",
      ruleOfThumb: "Cifrado con control de ciclo de vida de clave, separación de funciones o claves multi-región compartidas -> AWS KMS (Customer Managed Key)."
    },
    discardPattern: {
      antiPattern: "Guardar contraseñas de aplicaciones en texto plano dentro de la configuración de KMS.",
      whyDiscard: "KMS administra claves criptográficas de cifrado (hasta 4 KB de datos directos); no es un almacén de secretos de credenciales.",
      quickDiscard: "Descarta KMS si la pregunta pide almacenar y rotar contraseñas de bases de datos (eso es Secrets Manager)."
    },
    duel: {
      targetId: "secrets-manager",
      vs: "AWS KMS vs AWS CloudHSM",
      distinction: "KMS es un servicio multinquilino gestionado con APIs directas. CloudHSM ofrece hardware HSM dedicado monoinquilino bajo control exclusivo del cliente (requisito PKCS#11 o regulaciones no estándar)."
    }
  },
  {
    id: "sqs",
    name: "Amazon Simple Queue Service (SQS)",
    category: "Mensajería & Desacoplamiento",
    keywords: ["sqs", "simple queue service", "message queue", "decoupling", "fifo queue", "dead letter queue", "dlq", "visibility timeout", "buffer"],
    archetype: "Colas de mensajes completamente gestionadas para desacoplar y absorber picos de tráfico entre componentes distribuidos",
    winningPattern: {
      trigger: "Desacoplar productores y consumidores de manera asíncrona, absorber ráfagas masivas de peticiones sin perder mensajes, y garantizar orden estricto cuando sea necesario (SQS FIFO con deduplicación).",
      whyWins: "Escalado prácticamente infinito, tolerancia total a la caída de consumidores y soporte de Dead-Letter Queues (DLQ) para aislar mensajes con errores tras N reintentos.",
      ruleOfThumb: "Desacoplar componentes asíncronos y nivelar carga de trabajo -> SQS. Si el orden importa exactamente una vez -> SQS FIFO."
    },
    discardPattern: {
      antiPattern: "Usar SQS cuando se requiere que múltiples sistemas reciban simultáneamente una copia del mismo mensaje (patrón Pub/Sub fan-out).",
      whyDiscard: "En SQS, una vez que un consumidor procesa y borra un mensaje, este desaparece de la cola y ningún otro consumidor lo recibe.",
      quickDiscard: "Descarta SQS solo si se requiere Fan-out a múltiples suscriptores independientes (para eso se añade SNS antes de SQS)."
    },
    duel: {
      targetId: "sns",
      vs: "Amazon SQS vs Amazon SNS",
      distinction: "SQS es una cola (Pull, 1 a 1, retiene mensajes hasta que el consumidor los procesa). SNS es un tema Pub/Sub (Push, 1 a N fan-out instantáneo a múltiples suscriptores)."
    }
  },
  {
    id: "sns",
    name: "Amazon Simple Notification Service (SNS)",
    category: "Mensajería & Notificaciones",
    keywords: ["sns", "simple notification service", "pub/sub", "fanout", "topic", "push notification", "sms", "email notification"],
    archetype: "Servicio de mensajería Pub/Sub de alta disponibilidad para difusión instantánea (Fan-Out) a múltiples receptores",
    winningPattern: {
      trigger: "Publicar un mensaje una sola vez y hacer que múltiples sistemas heterogéneos (múltiples colas SQS, funciones Lambda, endpoints HTTP, emails, SMS) lo reciban de manera instantánea y paralela (Patrón SNS + SQS Fan-Out).",
      whyWins: "Entrega 'push' ultra-rápida a miles o millones de suscriptores sin servidores intermedios de mensajería.",
      ruleOfThumb: "Distribuir un mismo evento a múltiples servicios independientes en paralelo -> SNS Topic con suscripciones múltiples."
    },
    discardPattern: {
      antiPattern: "Usar SNS para almacenar mensajes esperando a que un servidor desconectado vuelva a encenderse para leerlos.",
      whyDiscard: "SNS no almacena mensajes; si no hay suscriptores disponibles o el endpoint falla sin retry policy, el mensaje se descarta (a menos que tenga DLQ configurada).",
      quickDiscard: "Descarta SNS si se requiere almacenar y acumular mensajes en una cola para procesarlos por lotes al ritmo del consumidor."
    },
    duel: {
      targetId: "sqs",
      vs: "SNS + SQS Fan-Out vs SQS Directo",
      distinction: "SNS solo envía y no retiene; SQS retiene y amortigua. El patrón Fan-Out une ambos: 1 SNS Topic publica a N colas SQS independientes."
    }
  },
  {
    id: "eventbridge",
    name: "Amazon EventBridge",
    category: "Integración Serverless & Eventos",
    keywords: ["eventbridge", "event bus", "cloudwatch events", "content-based filtering", "scheduled rule", "saas partner integration", "schema registry"],
    archetype: "Bus de eventos serverless que conecta aplicaciones con datos de servicios AWS, SaaS propios y reglas de filtrado avanzadas",
    winningPattern: {
      trigger: "Enrutar eventos basados en el contenido JSON del mensaje (filtros declarativos avanzados sin código), programar tareas cron periódicas, o reaccionar a cambios de estado en servicios de AWS (ej. cambios en S3, CloudTrail).",
      whyWins: "Filtrado basado en contenido nativo, transformación de eventos antes de entregarlos al target y más de 20 destinos AWS integrados sin necesidad de Lambda intermedia.",
      ruleOfThumb: "Enrutamiento de eventos con filtrado JSON avanzado, integración SaaS o tareas programadas cron serverless -> Amazon EventBridge."
    },
    discardPattern: {
      antiPattern: "Escribir una función Lambda solo para inspeccionar el JSON de un evento y decidir a qué cola enviarlo.",
      whyDiscard: "EventBridge realiza filtrado y enrutamiento basado en contenido de forma nativa sin escribir ni mantener código Lambda.",
      quickDiscard: "Descarta Lambdas intermediarias de enrutamiento si EventBridge puede evaluar el patrón JSON en las reglas del bus."
    },
    duel: {
      targetId: "sns",
      vs: "EventBridge vs Amazon SNS",
      distinction: "EventBridge ofrece filtrado complejo por contenido JSON, integración con docenas de servicios AWS/SaaS y schema registry. SNS ofrece mayor rendimiento y menor latencia para fan-out masivo simple."
    }
  },
  {
    id: "step-functions",
    name: "AWS Step Functions",
    category: "Orquestación de Flujos de Trabajo",
    keywords: ["step functions", "state machine", "workflow orchestration", "saga pattern", "distributed transaction", "human in the loop", "retry logic", "error handling"],
    archetype: "Orquestador visual serverless de flujos de trabajo multi-paso, manejo de estado y coordinación de microservicios",
    winningPattern: {
      trigger: "Coordinar múltiples servicios distribuidos en una secuencia lógica (pasos condicionales, bifurcaciones paralelas, reintentos con backoff exponencial, transacciones compensatorias/Saga y pausas para aprobación humana).",
      whyWins: "Mantiene el estado de la ejecución automáticamente por hasta 1 año, eliminando la necesidad de persistir estados intermedios en bases de datos dentro de cada Lambda.",
      ruleOfThumb: "Orquestar flujos de trabajo distribuidos con reintentos complejos, manejo de excepciones o transacciones de larga duración -> AWS Step Functions."
    },
    discardPattern: {
      antiPattern: "Invocar una función Lambda desde otra función Lambda de forma síncrona encadenada en cascada, pagando tiempo de espera ocioso en cada nivel.",
      whyDiscard: "El encadenamiento de Lambdas crea acoplamiento frágil, duplica costes de inactividad y dificulta el manejo de compensaciones ante fallos.",
      quickDiscard: "Descarta encadenar Lambdas directamente si el proceso tiene múltiples ramas y requiere manejo de errores robusto."
    },
    duel: {
      targetId: "lambda",
      vs: "Step Functions vs Orquestación con Lambda",
      distinction: "Step Functions gestiona el flujo, las ramas, los reintentos y el estado. Lambda ejecuta el cómputo atómico en cada estado."
    }
  },
  {
    id: "kinesis-streams",
    name: "Amazon Kinesis Data Streams",
    category: "Streaming en Tiempo Real",
    keywords: ["kinesis data streams", "kinesis stream", "shards", "real-time streaming", "sub-second data ingestion", "consumer replay", "kinesis enhanced fan-out"],
    archetype: "Ingesta y procesamiento masivo de datos en streaming en tiempo real con retención de datos y capacidad de repetición para múltiples consumidores",
    winningPattern: {
      trigger: "Ingesta continua de datos con latencia sub-segundo, donde múltiples aplicaciones consumidoras necesitan leer los mismos datos a su propio ritmo con capacidad de reproducción/replay de hasta 365 días.",
      whyWins: "Permite particionar el flujo en shards para rendimiento ultra-escalable y Enhanced Fan-Out para proveer ancho de banda dedicado a cada consumidor.",
      ruleOfThumb: "Streaming continuo con lectura concurrente de múltiples consumidores independientes o necesidad de replay temporal -> Kinesis Data Streams."
    },
    discardPattern: {
      antiPattern: "Elegir Kinesis Data Streams para entregar registros a S3 o Redshift sin requerir procesamiento personalizado intermedio.",
      whyDiscard: "Data Streams requiere programar consumidores o Lambdas personalizadas para escribir a S3; Kinesis Data Firehose hace eso de forma totalmente gestionada y sin código.",
      quickDiscard: "Descarta Data Streams si la única meta es volcar datos a S3/Redshift/OpenSearch (usa Kinesis Firehose)."
    },
    duel: {
      targetId: "kinesis-firehose",
      vs: "Kinesis Data Streams vs Kinesis Data Firehose",
      distinction: "Data Streams: ingesta en tiempo real (< 1s), requiere gestión de shards y código consumidor, retiene datos para replay. Firehose: entrega casi en tiempo real (buffer 60s+), serverless, sin código, escribe directo a S3/Redshift/OpenSearch."
    }
  },
  {
    id: "kinesis-firehose",
    name: "Amazon Kinesis Data Firehose",
    category: "Ingesta Serverless & Almacenamiento",
    keywords: ["kinesis data firehose", "kinesis firehose", "firehose", "near real-time delivery", "buffer size", "buffer interval", "direct to s3", "data transformation lambda"],
    archetype: "Entrega continua totalmente gestionada y sin servidores de datos en streaming hacia S3, Redshift, OpenSearch y Splunk",
    winningPattern: {
      trigger: "Cargar datos en streaming hacia destinos de almacenamiento analítico (Amazon S3, Amazon Redshift, OpenSearch, HTTP endpoints) de forma totalmente automatizada, con compresión, conversión a formato Parquet y buffer ajustable (mínimo 60 seg / 1 MB).",
      whyWins: "Completamente serverless: no hay shards que aprovisionar ni código consumidor que mantener. Escala elásticamente de forma automática.",
      ruleOfThumb: "Ingesta masiva de datos y volcado directo a S3/Redshift sin administrar infraestructura -> Kinesis Data Firehose."
    },
    discardPattern: {
      antiPattern: "Elegir Firehose cuando la aplicación requiere procesamiento en tiempo real con latencia menor a 1 segundo.",
      whyDiscard: "Firehose tiene un intervalo mínimo de búfer de 60 segundos (o 1 MB de datos acumulados); no puede entregar datos en tiempo real de milisegundos.",
      quickDiscard: "Descarta Firehose si el enunciado exige 'real-time processing under 1 second latency'."
    },
    duel: {
      targetId: "kinesis-streams",
      vs: "Firehose vs Data Streams",
      distinction: "Firehose para entrega gestionada sin servidores con buffer (> 60s). Streams para procesamiento activo e inmediato en tiempo real (< 1s)."
    }
  },
  {
    id: "dms",
    name: "AWS Database Migration Service (DMS)",
    category: "Migración de Bases de Datos",
    keywords: ["dms", "database migration service", "cdc", "change data capture", "continuous replication", "homogeneous migration", "heterogeneous migration", "sct"],
    archetype: "Migración y replicación continua de bases de datos relacionales y no relacionales minimizando el tiempo de inactividad",
    winningPattern: {
      trigger: "Migrar bases de datos locales a AWS (o entre motores de AWS) sin interrumpir el funcionamiento del negocio, manteniendo la base de datos de origen y la de destino sincronizadas continuamente mediante Change Data Capture (CDC).",
      whyWins: "Admite migraciones homogéneas y heterogéneas (combinado con AWS Schema Conversion Tool - SCT) y permite cambiar a la nueva BD con minutos de conmutación final.",
      ruleOfThumb: "Migrar base de datos on-premise a AWS con tiempo de inactividad casi cero -> AWS DMS con replicación continua (CDC)."
    },
    discardPattern: {
      antiPattern: "Realizar una exportación por dump/backup de la base de datos y restaurarla en AWS durante un mantenimiento de fin de semana para bases de datos de terabytes.",
      whyDiscard: "El tiempo de transferencia y restauración causaría horas o días de caída del servicio inaceptables para el negocio.",
      quickDiscard: "Descarta snapshots estáticos o exportaciones si el requerimiento pide 'near-zero downtime' o 'continuous replication'."
    },
    duel: {
      targetId: "aurora",
      vs: "AWS DMS vs Backup/Restore Tradicional",
      distinction: "DMS copia los datos iniciales y luego replica continuamente cada cambio (CDC) en segundo plano hasta el corte final sin downtime. Backup/Restore exige congelar la base de datos."
    }
  },
  {
    id: "transfer-family",
    name: "AWS Transfer Family",
    category: "Migración & Transferencia de Archivos",
    keywords: ["transfer family", "sftp", "ftps", "ftp", "managed sftp", "as2", "external partners file transfer"],
    archetype: "Servidor SFTP/FTPS completamente administrado que almacena archivos directamente en Amazon S3 o Amazon EFS",
    winningPattern: {
      trigger: "Permitir que clientes o socios comerciales externos continúen transfiriendo archivos mediante SFTP/FTPS utilizando sus flujos de trabajo y clientes existentes, pero almacenando los archivos directamente en buckets de S3 o sistemas EFS.",
      whyWins: "Cero cambios para los clientes externos, alta disponibilidad nativa y eliminación total de instancias EC2 autogestionadas con servidores SFTP expuestos.",
      ruleOfThumb: "Migrar flujos SFTP/FTPS de clientes externos directamente a S3 con mínimo overhead -> AWS Transfer Family."
    },
    discardPattern: {
      antiPattern: "Desplegar instancias EC2 con software SFTP open source detrás de un NLB para recibir archivos de socios.",
      whyDiscard: "Exige mantenimiento de servidores, parches de seguridad del SO, escalado manual y almacenamiento EBS no elástico.",
      quickDiscard: "Descarta EC2 SFTP auto-gestionado si se pide minimizar el mantenimiento operacional."
    },
    duel: {
      targetId: "s3-storage-classes",
      vs: "AWS Transfer Family vs S3 API Directo",
      distinction: "Transfer Family permite a clientes antiguos seguir usando protocolos SFTP sin modificar sus sistemas. S3 API exige que los clientes usen AWS SDK o llamadas HTTPS."
    }
  },
  {
    id: "waf-shield",
    name: "AWS WAF & AWS Shield",
    category: "Seguridad Perimetral & DDoS",
    keywords: ["waf", "web application firewall", "shield", "shield advanced", "layer 7 attack", "sql injection", "xss", "ddos mitigation", "rate-based rule"],
    archetype: "Protección perimetral frente a ataques web comunes en Capa 7 (WAF) y mitigación avanzada contra ataques DDoS masivos (Shield)",
    winningPattern: {
      trigger: "Bloquear ataques web maliciosos (inyecciones SQL, Cross-Site Scripting XSS, bots de scraping, limitación de tasa por IP) en CloudFront, ALB o API Gateway, y proteger frente a ataques DDoS en Capa 3/4/7 con Shield Advanced.",
      whyWins: "Inspección e interceptación en tiempo real antes de que el tráfico alcance la infraestructura de la aplicación, con reglas gestionadas de AWS actualizadas continuamente.",
      ruleOfThumb: "Proteger aplicaciones web frente a SQLi, XSS, bots o ataques a nivel de petición HTTP -> AWS WAF."
    },
    discardPattern: {
      antiPattern: "Usar Security Groups o Network ACLs para bloquear ataques de inyección SQL o peticiones HTTP maliciosas.",
      whyDiscard: "Security Groups y NACLs operan en Capa 3 y 4 (IPs y puertos); son incapaces de inspeccionar cabeceras HTTP, cookies o queries SQL dentro del cuerpo de la petición.",
      quickDiscard: "Descarta Security Groups o NACLs para mitigar ataques a nivel de aplicación HTTP (SQLi, XSS)."
    },
    duel: {
      targetId: "guardduty",
      vs: "AWS WAF vs AWS Network Firewall",
      distinction: "WAF protege tráfico HTTP/HTTPS en balanceadores, CDN y APIs en Capa 7. Network Firewall inspecciona todo el tráfico de red de la VPC a nivel de paquetes IP y protocolos arbitrarios."
    }
  },
  {
    id: "opensearch",
    name: "Amazon OpenSearch Service",
    category: "Analítica & Búsqueda",
    keywords: ["opensearch", "elasticsearch", "log analytics", "full-text search", "kibana", "opensearch dashboards", "indexing"],
    archetype: "Motor de búsqueda de texto completo distribuido y análisis de logs en tiempo real con dashboards interactivos",
    winningPattern: {
      trigger: "Búsqueda interactiva de texto libre en catálogos de productos, filtrado facetado complejo, análisis y visualización de millones de líneas de log de aplicaciones en tiempo real.",
      whyWins: "Indexación invertida distribuida de alta velocidad optimizada para consultas de texto no estructurado que serían inviables en bases de datos relacionales.",
      ruleOfThumb: "Búsqueda textual rápida, autocomplete o análisis visual de logs -> Amazon OpenSearch Service."
    },
    discardPattern: {
      antiPattern: "Usar RDS PostgreSQL o DynamoDB con escaneos de texto completo (`LIKE '%termino%'`) sobre millones de registros a gran escala.",
      whyDiscard: "Provoca table scans masivos que saturan la CPU de la base de datos y disparan la latencia a decenas de segundos.",
      quickDiscard: "Descarta consultas SQL de texto libre con comodines en bases de datos relacionales para motores de búsqueda de gran volumen."
    },
    duel: {
      targetId: "dynamodb",
      vs: "Amazon OpenSearch vs DynamoDB",
      distinction: "DynamoDB es óptimo para búsquedas por clave primaria exacta. OpenSearch es óptimo para búsquedas difusas, filtros facetados y análisis de texto completo."
    }
  },
  {
    id: "backup",
    name: "AWS Backup",
    category: "Gobernanza & Continuidad de Negocio",
    keywords: ["aws backup", "centralized backup", "backup policy", "cross-region backup", "cross-account backup", "vault lock", "immutable backup"],
    archetype: "Gestión centralizada y automatizada de copias de seguridad entre cuentas y regiones con protección frente a ransomware",
    winningPattern: {
      trigger: "Centralizar, automatizar y auditar políticas de retención y copia de seguridad en múltiples servicios AWS (EBS, RDS, Aurora, DynamoDB, EFS, S3), con copia automática a otra región y cuenta secundaria, y bóveda inmutable bloqueada contra borrado accidental o ransomware.",
      whyWins: "Elimina scripts manuales y cron jobs de snapshots; soporta AWS Backup Vault Lock para cumplir con regulaciones de inmutabilidad.",
      ruleOfThumb: "Gestión centralizada de copias de seguridad multi-servicio, cross-region y cross-account con protección contra ransomware -> AWS Backup."
    },
    discardPattern: {
      antiPattern: "Escribir funciones Lambda con cron jobs de EventBridge para tomar snapshots de volúmenes EBS y copiarlos manualmente a otra cuenta.",
      whyDiscard: "Genera deuda técnica, fragilidad de mantenimiento y falta de reportes centralizados de cumplimiento que AWS Backup ya resuelve de forma nativa.",
      quickDiscard: "Descarta scripts personalizados de snapshot si AWS Backup está disponible como opción nativa."
    },
    duel: {
      targetId: "s3-storage-classes",
      vs: "AWS Backup vs Snapshots Nativos por Servicio",
      distinction: "AWS Backup centraliza políticas, programación, cumplimiento normativo y copias cross-account en un solo panel para toda la organización."
    }
  },
  {
    id: "cognito",
    name: "Amazon Cognito (User Pools & Identity Pools)",
    category: "Identidad & Autenticación de Clientes",
    keywords: ["cognito", "user pool", "identity pool", "federated identities", "customer authentication", "mfa", "hosted ui", "social login"],
    archetype: "Servicio de gestión de identidades, registro, inicio de sesión y control de acceso seguro para millones de usuarios externos en apps móviles y web",
    winningPattern: {
      trigger: "Autenticar usuarios finales de aplicaciones web y móviles (B2C), registro con correo/contraseña o inicio de sesión social (Google, Apple, Facebook), autenticación multifactor (MFA), emisión de tokens JWT y federación directa con ALB o API Gateway.",
      whyWins: "User Pools gestiona el directorio de usuarios y tokens; Identity Pools intercambia esos tokens por credenciales temporales de AWS IAM para acceder a recursos de AWS directamente (como S3 o DynamoDB).",
      ruleOfThumb: "Autenticación y registro de usuarios finales externos con MFA integrado en ALB o API Gateway -> Amazon Cognito User Pools."
    },
    discardPattern: {
      antiPattern: "Usar IAM Identity Center (AWS SSO) para clientes finales de una tienda online o aplicación móvil masiva.",
      whyDiscard: "IAM Identity Center está diseñado para empleados y fuerza de trabajo interna que acceden a la consola de AWS o aplicaciones empresariales, no para millones de consumidores finales.",
      quickDiscard: "Descarta IAM Identity Center si los usuarios son clientes externos de una aplicación de consumo masivo."
    },
    duel: {
      targetId: "iam-identity-center",
      vs: "Amazon Cognito vs AWS IAM Identity Center",
      distinction: "Cognito es para usuarios y clientes finales de aplicaciones externas (B2C). IAM Identity Center es para la fuerza de trabajo interna de la empresa (B2E) que accede a cuentas de AWS."
    }
  }
];

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWordMatch(text, term) {
  if (!text || !term) return false;
  const rx = new RegExp("\\b" + escapeRegex(term) + "\\b", "i");
  return rx.test(text);
}

/**
 * Encuentra el arquetipo de componente AWS más relevante a partir del texto de una opción o del contexto.
 * Aplica ponderación por nombre de servicio, palabras clave con límites de palabra (evitando colisiones) y bonificación posicional.
 */
function findBestComponent(text = "", contextText = "", excludeId = null) {
  if (!text && !contextText) return null;
  const targetText = String(text || "");
  const firstChunk = targetText.slice(0, 80);
  const fullContext = (targetText + " " + String(contextText || ""));

  let best = null;
  let maxScore = -1;

  for (const comp of AWS_COMPONENTS) {
    if (excludeId && comp.id === excludeId) continue;
    let score = 0;

    const fullName = comp.name;
    const cleanName = comp.name.replace(/\s*\([^)]*\)/g, "").trim();

    // 1. Coincidencia de nombre exacto (con límites de palabra para evitar subcadenas)
    if (hasWordMatch(targetText, fullName) || hasWordMatch(targetText, cleanName)) {
      score += 40;
    }
    // Bonificación de posición si el componente abre la opción (sujeto principal de la arquitectura)
    if (hasWordMatch(firstChunk, fullName) || hasWordMatch(firstChunk, cleanName)) {
      score += 30;
    }

    // 2. Coincidencia de palabras clave con límite de palabra
    for (const kw of comp.keywords) {
      if (!kw || kw.length < 3) continue; // Descartar subcadenas de 2 letras que colisionan (ej. 'ou')
      if (hasWordMatch(targetText, kw)) {
        score += 14;
        if (hasWordMatch(firstChunk, kw)) {
          score += 16;
        }
      }
      if (hasWordMatch(fullContext, kw)) {
        score += 4;
      }
    }

    if (hasWordMatch(fullContext, cleanName)) {
      score += 10;
    }

    if (score > maxScore && score >= 20) {
      maxScore = score;
      best = comp;
    }
  }

  return best;
}

/**
 * Genera un análisis arquitectónico bipolar completo para una pregunta de examen:
 * - Identifica el Componente Ganador (Patrón de Acierto)
 * - Identifica el Componente Rechazado / Trampa (Patrón de Descarte)
 * - Extrae el Duelo 2x2 Clásico y su heurística de decisión en 5 segundos
 */
function getQuestionArchetypeAnalysis(question, userSelected = []) {
  if (!question) return null;

  // 1. Obtener la respuesta correcta activa (Consenso comunidad o personalización)
  let effectiveCorrect = "";
  if (typeof store !== "undefined" && store && typeof store.getEffectiveCorrectAnswer === "function") {
    effectiveCorrect = store.getEffectiveCorrectAnswer(question);
  } else if (question.communityVote) {
    const m = String(question.communityVote).trim().match(/^([A-F]+)/i);
    effectiveCorrect = m ? m[1].toUpperCase() : String(question.correctAnswer || "").toUpperCase();
  } else {
    effectiveCorrect = String(question.correctAnswer || "").toUpperCase();
  }

  const choices = question.choices || {};
  const effectiveLetters = effectiveCorrect.split("");

  // Texto de la opción o combinación ganadora
  const winningText = effectiveLetters.map(l => choices[l] || "").join(" ");

  // Opciones descartadas / distractores
  let discardedLetters = [];
  if (Array.isArray(userSelected) && userSelected.length > 0) {
    discardedLetters = userSelected.filter(l => !effectiveLetters.includes(l));
  }
  if (discardedLetters.length === 0) {
    // Si el usuario acertó o no hay selección, tomar las opciones que no son correctas
    discardedLetters = Object.keys(choices).filter(l => !effectiveLetters.includes(l));
  }

  const userDiscardedText = discardedLetters.map(l => choices[l] || "").join(" ");
  const qStem = question.question || "";

  // Componente ganador
  const winningComponent = findBestComponent(winningText, qStem + " " + winningText);

  // Componente descartado (evaluamos la selección del usuario o la opción individual más representativa)
  let discardedComponent = null;

  // Primero comprobar individualmente cada opción elegida por el usuario
  if (discardedLetters.length > 0) {
    let topScoreChoice = -1;
    for (const letter of discardedLetters) {
      const singleText = choices[letter] || "";
      const cand = findBestComponent(singleText, qStem, winningComponent ? winningComponent.id : null);
      if (cand) {
        discardedComponent = cand;
        break;
      }
    }
  }

  // Fallback con el texto conjunto si no se encontró en opciones individuales
  if (!discardedComponent) {
    discardedComponent = findBestComponent(userDiscardedText, qStem + " " + userDiscardedText, winningComponent ? winningComponent.id : null);
  }

  // Duelo directo entre ambos componentes
  let duel = null;
  if (winningComponent && discardedComponent && winningComponent.id !== discardedComponent.id) {
    if (winningComponent.duel && winningComponent.duel.targetId === discardedComponent.id) {
      duel = {
        vs: winningComponent.duel.vs,
        distinction: winningComponent.duel.distinction
      };
    } else if (discardedComponent.duel && discardedComponent.duel.targetId === winningComponent.id) {
      duel = {
        vs: discardedComponent.duel.vs,
        distinction: discardedComponent.duel.distinction
      };
    } else {
      duel = {
        vs: `${winningComponent.name} vs ${discardedComponent.name}`,
        distinction: `${winningComponent.name}: ${winningComponent.winningPattern.ruleOfThumb} Por contra, ${discardedComponent.name}: ${discardedComponent.discardPattern.quickDiscard}`
      };
    }
  } else if (winningComponent && winningComponent.duel) {
    duel = {
      vs: winningComponent.duel.vs,
      distinction: winningComponent.duel.distinction
    };
  }

  // Patrón histórico del bloque si existe
  const legacyPattern = typeof findBestPatternForQuestion === "function" ? findBestPatternForQuestion(question) : null;

  return {
    effectiveCorrect,
    winningComponent,
    discardedComponent,
    duel,
    legacyPattern
  };
}

// =========================================================================
// EXPORTACIONES UNIFICADAS (NAVEGADOR & NODE.JS)
// =========================================================================

if (typeof window !== 'undefined') {
  window.REPEMILL_DATA = REPEMILL_DATA;
  window.AWS_COMPONENTS = AWS_COMPONENTS;
  window.findBestComponent = findBestComponent;
  window.getQuestionArchetypeAnalysis = getQuestionArchetypeAnalysis;
  window.findBestPatternForQuestion = findBestPatternForQuestion;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REPEMILL_DATA,
    AWS_COMPONENTS,
    findBestComponent,
    getQuestionArchetypeAnalysis,
    findBestPatternForQuestion
  };
}

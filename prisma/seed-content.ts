import type { PageContent, ServiceContent } from "../src/lib/content/schemas";

/**
 * Starter content. It describes capabilities in general terms and contains no
 * client names, testimonials, certifications or numeric claims (URS-010,
 * BR-07). The business must review and approve every page before launch.
 */

export interface SeedService {
  slug: string;
  name: string;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  content: ServiceContent;
}

const commonApproach = (discoveryFocus: string) => [
  { title: "Discover", description: discoveryFocus },
  {
    title: "Design",
    description:
      "We agree the target process, architecture and acceptance criteria before build starts, so scope and cost are visible early.",
  },
  {
    title: "Build and validate",
    description:
      "Work is delivered in short increments that your team reviews, with automated tests and user acceptance at each stage.",
  },
  {
    title: "Deploy and support",
    description:
      "We plan cut-over, train your users, and stay on hand to stabilise, maintain and improve the solution.",
  },
];

export const SERVICES: SeedService[] = [
  {
    slug: "erp-solutions",
    name: "Enterprise ERP Solutions",
    sortOrder: 1,
    seoTitle: "Enterprise ERP implementation, integration and modernisation",
    seoDescription:
      "ERP implementation, enhancement, integration and workflow design that connect finance, operations and reporting into one reliable process.",
    content: {
      headline: "Connect your operations with an ERP that fits how you work",
      summary:
        "Implementation, enhancement, integration and modernisation of ERP systems so finance, operations and management work from the same reliable data.",
      intro:
        "Many organisations outgrow spreadsheets and disconnected tools long before they notice. Orders are re-keyed, stock figures disagree between teams, and month-end becomes a reconciliation exercise.\n\nWe help you implement or improve an ERP platform around your real processes, integrate it with the systems you keep, and give leadership dependable visibility.",
      audiences: [
        "Growing SMEs",
        "Multi-site operations",
        "Finance and operations leaders",
        "Organisations replacing legacy ERP",
      ],
      problems: [
        "The same data is entered in several systems, causing errors and delays.",
        "Stock, order or financial figures differ depending on who you ask.",
        "Month-end and reporting rely on manual spreadsheet consolidation.",
        "The current ERP is heavily customised, hard to upgrade or no longer supported.",
        "Approvals and workflows happen over email with little traceability.",
      ],
      capabilities: [
        {
          title: "ERP implementation",
          description:
            "Configuration of finance, procurement, inventory, sales and related modules around agreed processes.",
        },
        {
          title: "Process and workflow design",
          description:
            "Mapping current and target processes, approvals and controls before configuration begins.",
        },
        {
          title: "Integration",
          description:
            "Connecting ERP with e-commerce, CRM, banking, logistics and other line-of-business systems through APIs.",
        },
        {
          title: "Data migration",
          description:
            "Cleansing, mapping and reconciling master and transactional data, with rehearsed cut-over.",
        },
        {
          title: "Enhancement and modernisation",
          description:
            "Extending an existing ERP or moving from legacy customisations to maintainable, supported patterns.",
        },
        {
          title: "Reporting",
          description:
            "Operational and management reports built on a single, trusted source of data.",
        },
      ],
      outcomes: [
        {
          text: "Less duplicate data entry between departments and systems.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Faster, more predictable period-end close.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Consistent operational figures that management can rely on.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Clear approval trails for purchasing and finance processes.",
          evidence: "illustrative",
          evidenceNote: "",
        },
      ],
      deliveryApproach: commonApproach(
        "We review your processes, systems and data quality, and identify which modules and integrations deliver value first.",
      ),
      technologies: [
        "ERP platforms (to be confirmed)",
        "REST and SOAP APIs",
        "Integration middleware",
        "SQL databases",
        "Data migration tooling",
      ],
      faqs: [
        {
          question: "Do you work with a specific ERP product?",
          answer:
            "Supported ERP platforms and modules are confirmed during discovery so that we recommend what suits your requirements rather than a fixed product.",
        },
        {
          question: "Can you improve the ERP we already have?",
          answer:
            "Yes. Many engagements start by stabilising, integrating or extending an existing ERP rather than replacing it.",
        },
        {
          question: "How do you reduce go-live risk?",
          answer:
            "We rehearse data migration, test end-to-end business scenarios with your users and agree a cut-over and fallback plan before go-live.",
        },
      ],
      ctaHeading: "Discuss your ERP challenge",
      ctaText:
        "Tell us how your processes run today and where they break down. We will suggest a sensible first step.",
      ctaLabel: "Discuss your ERP project",
    },
  },
  {
    slug: "custom-software",
    name: "Custom Software Development",
    sortOrder: 2,
    seoTitle: "Custom software development and API integration",
    seoDescription:
      "Bespoke business applications, APIs and integrations designed around your processes, from discovery and architecture to long-term evolution.",
    content: {
      headline: "Software designed around the way your business actually works",
      summary:
        "Discovery, architecture and development of bespoke applications and integrations when off-the-shelf software does not fit your process.",
      intro:
        "Packaged software is the right answer surprisingly often. When your process is genuinely distinctive, however, forcing it into a generic product creates workarounds, manual steps and frustrated users.\n\nWe design and build maintainable custom software, starting with a clear understanding of the problem and the value it should deliver.",
      audiences: [
        "Organisations with distinctive processes",
        "Startups building a product",
        "Teams replacing spreadsheets and legacy tools",
      ],
      problems: [
        "Off-the-shelf tools need so many workarounds that they no longer save time.",
        "Critical processes depend on spreadsheets or a single person's knowledge.",
        "Legacy applications are fragile, undocumented or hard to change.",
        "Systems do not talk to each other, so information is copied by hand.",
      ],
      capabilities: [
        {
          title: "Discovery and requirements",
          description:
            "Workshops, process analysis and prioritised requirements with acceptance criteria.",
        },
        {
          title: "Architecture",
          description:
            "Pragmatic, secure designs that match your scale, budget and operating model.",
        },
        {
          title: "Application development",
          description: "Web-based business applications, internal tools and back-office systems.",
        },
        {
          title: "API development and integration",
          description:
            "Well-documented APIs and integrations with third-party and internal systems.",
        },
        {
          title: "Modernisation",
          description:
            "Incremental replacement or refactoring of legacy applications with minimal disruption.",
        },
        {
          title: "Maintenance and evolution",
          description: "Ongoing support, security updates and continuous improvement after launch.",
        },
      ],
      outcomes: [
        {
          text: "A tool that matches your process instead of forcing workarounds.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Reduced manual handling and fewer errors between systems.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Software your team can maintain and extend with confidence.",
          evidence: "illustrative",
          evidenceNote: "",
        },
      ],
      deliveryApproach: commonApproach(
        "We clarify the problem, users and constraints, and test whether existing products could meet the need before recommending a build.",
      ),
      technologies: [
        "TypeScript",
        "React",
        "Node.js",
        ".NET",
        "Python",
        "PostgreSQL",
        "REST and GraphQL APIs",
        "Cloud platforms",
      ],
      faqs: [
        {
          question: "Will we own the source code?",
          answer:
            "Ownership and licensing are agreed in the contract. Our standard approach is that you receive the source code and documentation for software built for you.",
        },
        {
          question: "How do you estimate cost?",
          answer:
            "After discovery we provide an estimate based on prioritised requirements, and we deliver in increments so you can adjust scope as you learn.",
        },
      ],
      ctaHeading: "Have a process that software should handle better?",
      ctaText:
        "Describe the problem, not the solution. We will help you work out whether custom software is the right answer.",
      ctaLabel: "Discuss your software idea",
    },
  },
  {
    slug: "web-development",
    name: "Website and Web Application Development",
    sortOrder: 3,
    seoTitle: "Corporate websites, portals and web application development",
    seoDescription:
      "Fast, accessible corporate websites, customer portals, dashboards and web applications that convert visitors and simplify digital interactions.",
    content: {
      headline: "Websites and web applications that work hard for your business",
      summary:
        "Corporate websites, customer portals, dashboards and responsive web applications built for performance, accessibility and conversion.",
      intro:
        "Your website is often the first serious conversation a prospect has with you. Customer-facing applications shape how easy you are to do business with.\n\nWe build fast, accessible and secure web experiences, integrated with the systems behind them, and easy for your team to update.",
      audiences: [
        "Marketing and digital teams",
        "Organisations with outdated websites",
        "Businesses digitising customer interactions",
      ],
      problems: [
        "The website is slow, hard to update or does not generate enquiries.",
        "Customers phone or email for things they could do themselves online.",
        "Information is spread across portals, spreadsheets and inboxes.",
        "The site does not work well on mobile or for people using assistive technology.",
      ],
      capabilities: [
        {
          title: "Corporate websites",
          description:
            "Content-managed websites with clear messaging, strong calls to action and search-friendly structure.",
        },
        {
          title: "Customer and partner portals",
          description: "Secure self-service experiences connected to your back-office systems.",
        },
        {
          title: "Dashboards and internal tools",
          description:
            "Responsive web applications that put the right information in front of the right people.",
        },
        {
          title: "Accessibility and performance",
          description: "Design and build aligned to WCAG 2.2 AA with measured page-speed targets.",
        },
        {
          title: "Integrations",
          description: "Forms, CRM, ERP, payments and identity integrations implemented securely.",
        },
      ],
      outcomes: [
        {
          text: "More qualified enquiries from a clearer, faster website.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Routine customer requests handled through self-service.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Content your team can update without a developer.",
          evidence: "illustrative",
          evidenceNote: "",
        },
      ],
      deliveryApproach: commonApproach(
        "We review your audiences, current analytics and content, and agree the journeys that matter most.",
      ),
      technologies: [
        "Next.js",
        "React",
        "TypeScript",
        "Headless CMS",
        "PostgreSQL",
        "Accessibility testing",
        "Core Web Vitals monitoring",
      ],
      faqs: [
        {
          question: "Can our team edit the website ourselves?",
          answer:
            "Yes. We provide a content management area so authorised staff can update pages, services and case studies without code changes.",
        },
        {
          question: "Do you design for accessibility?",
          answer:
            "We design and test against WCAG 2.2 AA, including keyboard and screen-reader checks on key journeys.",
        },
      ],
      ctaHeading: "Ready to improve your digital front door?",
      ctaText: "Tell us what your website or application needs to achieve.",
      ctaLabel: "Discuss your web project",
    },
  },
  {
    slug: "data-analytics-bi",
    name: "Data Analytics and Business Intelligence",
    sortOrder: 4,
    seoTitle: "Data analytics, BI dashboards and data integration",
    seoDescription:
      "Data integration, modelling, KPI dashboards and governed reporting that give management timely, consistent information for decisions.",
    content: {
      headline: "Turn scattered data into decisions you can trust",
      summary:
        "Data integration, modelling, KPI dashboards and governed reporting so leaders see timely, consistent numbers.",
      intro:
        "When reports take days to assemble and every department has its own version of the numbers, decisions slow down and confidence drops.\n\nWe bring your data together, define metrics once, and deliver dashboards and reports that people actually use.",
      audiences: [
        "Leadership teams",
        "Finance and operations",
        "Organisations dependent on spreadsheets for reporting",
      ],
      problems: [
        "Reports are assembled manually from spreadsheets and exports.",
        "Different teams report different figures for the same metric.",
        "Management sees information weeks after the period it describes.",
        "Data access is either too open or too restricted to be useful.",
      ],
      capabilities: [
        {
          title: "Data integration",
          description: "Automated pipelines from operational systems into a reporting platform.",
        },
        {
          title: "Data modelling",
          description: "Agreed definitions and models so each metric is calculated once.",
        },
        {
          title: "Dashboards and KPIs",
          description: "Role-based dashboards focused on the decisions each audience makes.",
        },
        {
          title: "Self-service reporting",
          description:
            "Curated datasets that let analysts answer questions without starting from raw data.",
        },
        {
          title: "Data governance",
          description:
            "Access controls, data quality checks and documentation appropriate to your organisation.",
        },
      ],
      outcomes: [
        {
          text: "One agreed version of key business metrics.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Less time spent compiling reports by hand.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "More timely visibility of operational performance.",
          evidence: "illustrative",
          evidenceNote: "",
        },
      ],
      deliveryApproach: commonApproach(
        "We identify the decisions that matter, the data sources behind them and the quality of that data today.",
      ),
      technologies: [
        "SQL",
        "Data warehouses",
        "ETL/ELT pipelines",
        "Power BI",
        "Python",
        "Cloud data platforms",
      ],
      faqs: [
        {
          question: "Do we need a data warehouse?",
          answer:
            "Not always. We recommend the simplest architecture that meets your reporting needs and can grow with you.",
        },
        {
          question: "Which BI tool do you use?",
          answer:
            "We work with the tools you already license where they fit, and recommend options when you are starting fresh.",
        },
      ],
      ctaHeading: "Want clearer numbers, sooner?",
      ctaText: "Tell us which decisions are slowed down by your current reporting.",
      ctaLabel: "Discuss your data needs",
    },
  },
  {
    slug: "ai-automation",
    name: "AI and Intelligent Automation",
    sortOrder: 5,
    seoTitle: "AI and intelligent automation for business processes",
    seoDescription:
      "Practical, governed AI and workflow automation: use-case discovery, document and data processing, and AI-assisted tools integrated with your systems.",
    content: {
      headline: "Practical AI and automation that removes repetitive work",
      summary:
        "Use-case discovery, workflow automation, document and data processing, and AI-assisted tools, implemented with appropriate governance.",
      intro:
        "AI and automation can free people from repetitive work and help them handle information faster. They can also add risk and cost when applied to the wrong problem.\n\nWe start with your processes, identify where automation is genuinely useful, and implement it with human oversight, security and measurable goals.",
      audiences: [
        "Operations teams with repetitive workloads",
        "Organisations exploring AI responsibly",
        "Teams processing high volumes of documents",
      ],
      problems: [
        "Skilled people spend hours on repetitive data entry and checking.",
        "Documents and emails are processed manually and inconsistently.",
        "Requests wait in queues because routing and triage are manual.",
        "Leadership wants to use AI but is unsure where it will add value safely.",
      ],
      capabilities: [
        {
          title: "Use-case discovery",
          description: "Assessing processes for automation and AI suitability, value and risk.",
        },
        {
          title: "Workflow automation",
          description:
            "Automating hand-offs, approvals, notifications and data movement between systems.",
        },
        {
          title: "Document and data processing",
          description:
            "Extracting and validating information from documents with human review where needed.",
        },
        {
          title: "AI-assisted experiences",
          description:
            "Search, summarisation and drafting tools grounded in your approved information.",
        },
        {
          title: "Governance and integration",
          description:
            "Access control, audit trails, evaluation and monitoring for AI-enabled processes.",
        },
      ],
      outcomes: [
        {
          text: "Less time spent on repetitive, low-value tasks.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "Faster and more consistent handling of routine requests.",
          evidence: "illustrative",
          evidenceNote: "",
        },
        {
          text: "AI adoption with clear oversight and accountability.",
          evidence: "illustrative",
          evidenceNote: "",
        },
      ],
      deliveryApproach: commonApproach(
        "We map candidate processes, estimate value and risk, and choose a small, measurable pilot.",
      ),
      technologies: [
        "Workflow automation platforms",
        "Large language models",
        "Document processing",
        "Python",
        "APIs and event-driven integration",
      ],
      faqs: [
        {
          question: "Is our data used to train AI models?",
          answer:
            "Data handling is agreed per engagement. We favour configurations where your data is not used to train third-party models and access is controlled and logged.",
        },
        {
          question: "Will automation replace our staff?",
          answer:
            "Our focus is removing repetitive work so people can concentrate on judgement, relationships and exceptions, with humans kept in the loop where decisions matter.",
        },
      ],
      ctaHeading: "Explore where automation could help",
      ctaText: "Tell us about the repetitive work your team handles today.",
      ctaLabel: "Discuss an automation idea",
    },
  },
];

export interface SeedPage {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  showInFooter: boolean;
  content: PageContent;
}

export const PAGES: SeedPage[] = [
  {
    slug: "home",
    title: "Home",
    seoTitle: "",
    seoDescription:
      "Technology partner for ERP, custom software, web applications, data analytics and AI automation, focused on practical business outcomes.",
    showInFooter: false,
    content: {
      heroTitle: "Technology that makes your business run better",
      heroIntro:
        "We help organisations connect their operations, build the software they need, and use data and automation to work smarter, explained in business terms and delivered with care.",
      sections: [
        {
          heading: "Who we work with",
          body: "",
          layout: "cards",
          items: [
            {
              title: "Small and medium-sized businesses",
              description:
                "Growing organisations that need dependable systems without enterprise overhead.",
            },
            {
              title: "Enterprises",
              description:
                "Teams that need a responsive partner for specific programmes, integrations or modernisation.",
            },
            {
              title: "Startups",
              description: "Founders who need a product built properly from the first release.",
            },
          ],
        },
        {
          heading: "How we work",
          body: "Every engagement follows a clear, collaborative path so you always know what is happening and why.",
          layout: "steps",
          items: [
            {
              title: "Discover",
              description:
                "Understand the problem, the people involved and what success looks like.",
            },
            {
              title: "Design",
              description: "Agree the solution, scope and acceptance criteria before build begins.",
            },
            {
              title: "Build and validate",
              description: "Deliver in increments with testing and your feedback at each stage.",
            },
            {
              title: "Deploy and support",
              description: "Launch carefully, train users and keep improving.",
            },
          ],
        },
      ],
    },
  },
  {
    slug: "about",
    title: "About us",
    seoTitle: "About us",
    seoDescription:
      "Who we are, what we believe and how we help organisations get more value from technology.",
    showInFooter: false,
    content: {
      heroTitle: "A technology partner focused on business outcomes",
      heroIntro:
        "We combine business analysis, engineering and data expertise to solve operational problems, not just to deliver technology.",
      sections: [
        {
          heading: "Our story",
          body: "[To be supplied by the organisation: company background, founding story and current focus. This placeholder must be replaced and approved before launch.]",
          layout: "text",
          items: [],
        },
        {
          heading: "Mission and vision",
          body: "",
          layout: "cards",
          items: [
            { title: "Mission", description: "[Approved mission statement to be supplied.]" },
            { title: "Vision", description: "[Approved vision statement to be supplied.]" },
          ],
        },
        {
          heading: "What we value",
          body: "",
          layout: "cards",
          items: [
            {
              title: "Clarity",
              description: "We explain options and trade-offs in plain language.",
            },
            {
              title: "Accountability",
              description: "We agree measurable acceptance criteria and own our commitments.",
            },
            {
              title: "Craftsmanship",
              description: "We build secure, maintainable solutions that last.",
            },
            {
              title: "Partnership",
              description: "We work alongside your team and share knowledge as we go.",
            },
          ],
        },
      ],
    },
  },
  {
    slug: "approach",
    title: "Our approach",
    seoTitle: "Our delivery approach",
    seoDescription:
      "How we discover, design, build, validate, deploy and support technology solutions with your team.",
    showInFooter: false,
    content: {
      heroTitle: "A delivery approach built on clarity and evidence",
      heroIntro:
        "Our engagements follow a consistent lifecycle that reduces risk, keeps you informed and focuses on the outcomes you need.",
      sections: [
        {
          heading: "The engagement lifecycle",
          body: "",
          layout: "steps",
          items: [
            {
              title: "Discovery",
              description:
                "Workshops and analysis to understand your goals, processes, users, systems and constraints.",
            },
            {
              title: "Design",
              description:
                "Solution design, architecture and a prioritised backlog with acceptance criteria.",
            },
            {
              title: "Build",
              description:
                "Incremental delivery with regular demonstrations and transparent progress.",
            },
            {
              title: "Validate",
              description:
                "Automated testing, security checks, accessibility checks and user acceptance testing.",
            },
            {
              title: "Deploy",
              description: "Planned release, data migration where needed, training and hand-over.",
            },
            {
              title: "Support",
              description: "Stabilisation, maintenance and continuous improvement.",
            },
          ],
        },
        {
          heading: "What you can expect",
          body: "You will have a named point of contact, visibility of progress and risks, and a say in priorities throughout. We document what we build so your team is never dependent on us to understand it.",
          layout: "text",
          items: [],
        },
      ],
    },
  },
  {
    slug: "privacy",
    title: "Privacy notice",
    seoTitle: "Privacy notice",
    seoDescription:
      "How we collect, use and protect personal information submitted through this website.",
    showInFooter: true,
    content: {
      heroTitle: "Privacy notice",
      heroIntro:
        "This notice explains how we handle personal information submitted through this website.",
      sections: [
        {
          heading: "Important",
          body: "[Draft template. Final wording, the data controller's identity, the legal basis, retention periods and data-subject rights must be supplied and approved by the organisation's privacy or legal adviser for the applicable jurisdictions before launch.]",
          layout: "text",
          items: [],
        },
        {
          heading: "What we collect",
          body: "When you submit an enquiry we collect your name, work email address, organisation, the services you are interested in, your project summary, and any optional details you choose to give, such as a phone number, country, timeline or budget range.\n\nWe also record the date and time of your submission, the version of this notice you acknowledged, and basic information about how you reached the form, such as a campaign tag.",
          layout: "text",
          items: [],
        },
        {
          heading: "How we use it",
          body: "We use your information only to review and respond to your enquiry and to manage any resulting business relationship. Access is limited to authorised staff. We do not sell your information.",
          layout: "text",
          items: [],
        },
        {
          heading: "How long we keep it",
          body: "[Retention period to be confirmed.] Enquiries that do not lead to an engagement are anonymised after the agreed retention period.",
          layout: "text",
          items: [],
        },
        {
          heading: "Your rights and contact",
          body: "[Describe data-subject rights applicable to your jurisdictions and how to exercise them, including the contact address for privacy requests.]",
          layout: "text",
          items: [],
        },
      ],
    },
  },
];

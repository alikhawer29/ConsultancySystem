const { normalize, join } = require("path");
const fs = require("fs");
const User = require("../models/user.model");
const Category = require("../models/category.model");
const { ROLES } = require("../utils");
const { getTotalSubscriptionRevenue } = require("../helpers/stripe");

const upload = async (req, res) => {
    try {
        if (!req.file) {
            throw new Error("No File Uploaded");
        }

        let { path } = req.file;

        path = normalize(path);

        return res.status(200).send({
            success: true,
            data: {
                path,
            },
        });
    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

const getData = async (_, res) => {
    try {
        let categories = await Category.find({ active: true })
            .select("name")
            .lean();
        categories = categories.map((item) => ({
            label: item.name,
            value: item._id,
        }));

        let data = {
            categories,
        };

        return res.status(200).send({
            success: true,
            data,
        });
    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

// let data = {
//     about_us: "https://",
//     privacy_policy: "https://",
//     terms: "https://"
// };

const getContent = async (req, res) => {
    try {
        let data = {
            about_us: `At Lynx Consultancy, we provide reliable and skilled staffing solutions tailored to the unique needs of healthcare facilities. Whether you need short-term shift coverage or long-term staff placement, our professionals are equipped to step in with confidence, compassion, and care.

We understand that every healthcare environment requires not just qualified staff, but people who genuinely care. That's why we carefully select and match registered nurses, healthcare assistants, support workers, and other allied health professionals who are both experienced and passionate about patient care.

Our goal is to help you maintain the highest standards of healthcare delivery while reducing the burden of recruitment and staffing stress. From hospitals and care homes to private clinics and rehabilitation centers, we provide dependable support that keeps your operations running smoothly.

We take pride in building long-term partnerships with our clients and being a trusted extension of their team. With our 24/7 availability, fast response time, and commitment to quality, you can always count on us when you need help the most.

Your patients deserve excellence — and Lynx Consultancy is here to deliver it.`,

            privacy_policy: `# Privacy Policy

**Last Updated:** January 1, 2024

## 1. Information We Collect

### Personal Information
- Name, email address, and contact details
- Professional credentials and qualifications
- Employment history and references
- Background check information

### Usage Data
- IP addresses and browser information
- Pages visited and time spent on our platform
- Device information and operating system

## 2. How We Use Your Information

We use the collected information to:
- Provide staffing and recruitment services
- Match healthcare professionals with suitable positions
- Verify credentials and qualifications
- Communicate important updates and opportunities
- Improve our services and user experience

## 3. Data Sharing and Disclosure

We may share information with:
- Healthcare facilities seeking staff
- Regulatory bodies for credential verification
- Service providers who assist our operations
- Legal authorities when required by law

## 4. Data Security

We implement industry-standard security measures including:
- SSL encryption for data transmission
- Secure servers with regular backups
- Access controls and authentication protocols
- Regular security audits and updates

## 5. Your Rights

You have the right to:
- Access your personal information
- Correct inaccurate data
- Request deletion of your information
- Opt-out of marketing communications
- Withdraw consent for data processing

## 6. Contact Us

For privacy-related inquiries, contact:
Email: privacy@lynxconsultancy.com
Phone: +1-555-0123
Address: 123 Healthcare Lane, Medical District, NY 10001`,

            terms: `# Terms and Conditions

**Last Updated:** January 1, 2024

## 1. Acceptance of Terms

By accessing and using Lynx Consultancy services, you agree to be bound by these Terms and Conditions. If you disagree with any part, you may not access our services.

## 2. Services Description

Lynx Consultancy provides:
- Healthcare staffing solutions
- Temporary and permanent placement
- Credential verification services
- Professional matching services
- 24/7 staffing support

## 3. User Responsibilities

### For Healthcare Professionals
- Maintain current licenses and certifications
- Provide accurate and truthful information
- Adhere to professional conduct standards
- Report any changes in availability or status

### For Healthcare Facilities
- Provide safe working environments
- Comply with employment laws and regulations
- Pay invoices according to agreed terms
- Communicate staffing needs clearly

## 4. Payment Terms

### Fee Structure
- Placement fees: 15-25% of annual salary
- Temporary staffing: Hourly rates plus markup
- Contract staffing: Weekly or monthly billing
- Specialized roles: Custom pricing

### Billing and Payment
- Invoices issued weekly/monthly
- Net 30 payment terms
- Late fees: 1.5% per month on overdue amounts
- Disputed charges must be reported within 7 days

## 5. Cancellation Policy

### Temporary Assignments
- Less than 24 hours notice: 4-hour minimum charge
- 24-48 hours notice: 2-hour minimum charge
- More than 48 hours notice: No charge

### Permanent Placements
- 90-day replacement guarantee
- Prorated refund if candidate leaves within guarantee period
- Replacement candidate provided at no additional cost

## 6. Intellectual Property

All content including:
- Logos and branding materials
- Software and platform code
- Training materials and documentation
- Business processes and methodologies

Are property of Lynx Consultancy and protected by copyright laws.

## 7. Limitation of Liability

Lynx Consultancy shall not be liable for:
- Indirect, incidental, or consequential damages
- Maximum liability limited to fees paid for services
- Acts or omissions of placed staff
- Facility-specific incidents or accidents

## 8. Termination

We may terminate services for:
- Breach of these terms
- Non-payment of fees
- Unprofessional conduct
- Misrepresentation of credentials

## 9. Governing Law

These terms are governed by the laws of the State of New York. Any disputes shall be resolved in courts located in New York County.

## 10. Contact Information

**Lynx Consultancy**
Email: legal@lynxconsultancy.com
Phone: +1-555-0124
Address: 123 Healthcare Lane, Medical District, NY 10001
Business Hours: Monday-Friday, 8:00 AM - 6:00 PM EST`,

            contact_info: {
                email: "info@lynxconsultancy.com",
                phone: "+1-555-0123",
                address: "123 Healthcare Lane, Medical District, New York, NY 10001",
                business_hours: {
                    weekdays: "8:00 AM - 6:00 PM",
                    saturday: "9:00 AM - 2:00 PM",
                    sunday: "Closed",
                },
            },

            services: [
                {
                    title: "Temporary Staffing",
                    description:
                        "Short-term healthcare professionals for shift coverage, seasonal demands, and emergency staffing needs.",
                    features: [
                        "24/7 Availability",
                        "Quick Response Time",
                        "Verified Credentials",
                    ],
                },
                {
                    title: "Permanent Placement",
                    description:
                        "Long-term staffing solutions with comprehensive screening and perfect candidate matching.",
                    features: [
                        "90-Day Guarantee",
                        "Thorough Screening",
                        "Custom Matching",
                    ],
                },
                {
                    title: "Specialized Recruitment",
                    description:
                        "Experts in recruiting for specialized medical fields and hard-to-fill positions.",
                    features: ["Industry Expertise", "Network Access", "Targeted Search"],
                },
            ],

            faqs: [
                {
                    question: "How quickly can you provide staff?",
                    image: "https://example.com/images/quick-staffing.jpg", // or "/assets/images/quick-staffing.jpg"
                    answer: "We can typically provide qualified staff within 4-24 hours for urgent requests, depending on role requirements and availability."
                },
                {
                    question: "What screening process do you use?",
                    image: "https://example.com/images/screening-process.jpg",
                    answer: "All candidates undergo comprehensive background checks, credential verification, reference checks, and skills assessments."
                },
                {
                    question: "Do you provide replacement if a staff member leaves?",
                    image: "https://example.com/images/replacement-guarantee.jpg",
                    answer: "Yes, we offer a 90-day replacement guarantee for permanent placements at no additional cost."
                },
                {
                    question: "What types of healthcare professionals do you provide?",
                    image: "https://example.com/images/healthcare-professionals.jpg",
                    answer: "We provide registered nurses, healthcare assistants, support workers, allied health professionals, and specialized medical staff for various healthcare settings."
                },
                {
                    question: "Are your staff licensed and certified?",
                    image: "https://example.com/images/certified-staff.jpg",
                    answer: "Yes, all our healthcare professionals are properly licensed, certified, and undergo regular credential verification to ensure compliance with industry standards."
                },
                {
                    question: "Do you provide staff for specialized medical units?",
                    image: "https://example.com/images/specialized-units.jpg",
                    answer: "Absolutely! We provide specialized staff for ICU, ER, pediatrics, oncology, mental health, and other specialized medical units with relevant experience and training."
                },
                {
                    question: "What are your service coverage areas?",
                    image: "https://example.com/images/coverage-areas.jpg",
                    answer: "We serve hospitals, care homes, private clinics, rehabilitation centers, and healthcare facilities across multiple states with 24/7 staffing support."
                },
                {
                    question: "How do you match staff to our specific needs?",
                    image: "https://example.com/images/staff-matching.jpg",
                    answer: "We conduct detailed assessments of your facility's requirements, culture, and specific needs to ensure perfect matches that benefit both your organization and our staff."
                }
            ]
        };

        return res.status(200).send({
            success: true,
            data,
        });
    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

module.exports = {
    upload,
    getData,
    getContent,
};

# HR & Payroll Management System

A modern, enterprise-grade HR and Payroll management solution built with Next.js, Firebase, and Tailwind CSS. This system is designed to streamline employee data management, payroll calculations, and statutory compliance (EPF/ETF/Tax) for Sri Lankan enterprises.

## ✨ Features

- **Employee Dossier**: Comprehensive employee profiles with job logistics and personal details.
- **Automated Payroll**: Accurate salary calculations including Basic, OT, No-Pay, and Allowances.
- **Statutory Compliance**: Automated EPF (12%/8%), ETF (3%), and PAYE/APIT tax calculations based on 2025 tables.
- **Governance Dashboard**: Admin controls for managing global rates and payroll finalized periods.
- **Email & Telegram Notifications**: Real-time alerts for payroll approvals and system messages.
- **Reporting Engine**: Print-ready Salary Detail Reports and Bank Transfer TXT generation.

## 🚀 Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/)
- **Database/Auth**: [Firebase](https://firebase.google.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)

## 🛠️ Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tglpeiris/hr-payroll-system.git
   cd hr-payroll-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file and add your keys (refer to the Deployment Guide).

4. **Run development server**:
   ```bash
   npm run dev
   ```

## 🌍 Deployment

The system is optimized for deployment on **Vercel**. Connect your GitHub repository to Vercel and configure the environment variables in the dashboard.

---

Built with ❤️ by tglpeiris

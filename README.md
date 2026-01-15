# Exchange Flow Management System

A comprehensive web application for managing school uniform exchange requests, warehouse operations, and invoicing processes. This system streamlines the entire exchange workflow from ticket creation to final invoicing.

## 🏗️ Application Overview

The Exchange Flow Management System is a role-based React application that handles the complete lifecycle of school uniform exchange requests. It provides different interfaces for support staff, warehouse personnel, invoicing teams, and administrators.

## 🚀 Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Date Handling**: date-fns

## 📋 Core Features

### 1. **Multi-Role Access Control**
- **Admin**: Full system access and user management
- **Support**: Create and manage exchange tickets
- **Warehouse**: Process returns and approve exchanges
- **Invoicing**: Handle billing and financial operations

### 2. **Ticket Management System**
- Create exchange requests with detailed customer information
- Track ticket status through predefined stages
- SLA monitoring and escalation alerts
- Comprehensive audit trail with event logging

### 3. **Warehouse Operations**
- Receive and inspect returned items
- Approve or deny exchange requests
- Manage inventory and stock levels
- Process exchange completions

### 4. **Invoicing & Billing**
- Generate invoices for approved exchanges
- Track payment status
- Financial reporting and analytics

## 🔄 Application Workflow

### 1. **Ticket Creation (Support Team)**
```
Customer Request → Support Team Creates Ticket → Ticket Status: LODGED
```
- Customer contacts support for uniform exchange
- Support staff creates new ticket with:
  - Customer details (name, phone, email)
  - Student information (name, grade, section)
  - Reason for exchange (wrong size, defective, etc.)
  - Items to be returned and exchanged
  - Order reference and notes

### 2. **Warehouse Processing (Warehouse Team)**
```
LODGED → WAREHOUSE_PENDING → WAREHOUSE_APPROVED/DENIED
```
- Warehouse receives returned items
- Inspects condition and verifies exchange eligibility
- Updates ticket status to:
  - `WAREHOUSE_APPROVED`: Items accepted for exchange
  - `WAREHOUSE_DENIED`: Items rejected (with reasons)

### 3. **Exchange Completion**
```
WAREHOUSE_APPROVED → EXCHANGE_COMPLETED
```
- Warehouse processes the exchange
- New items are prepared and shipped
- Ticket status updated to `EXCHANGE_COMPLETED`

### 4. **Invoicing Process (Invoicing Team)**
```
EXCHANGE_COMPLETED → INVOICING_PENDING → INVOICED
```
- Approved exchanges are sent to invoicing
- Invoices are generated based on exchange value
- Payment tracking and status updates

### 5. **Ticket Closure**
```
INVOICED → CLOSED
```
- Final review and closure of completed tickets
- Archive for future reference and reporting

## 📊 Ticket Stages & Status

### Ticket Stages
- **LODGED**: Initial ticket creation
- **WAREHOUSE_PENDING**: Awaiting warehouse processing
- **WAREHOUSE_APPROVED**: Warehouse approved exchange
- **WAREHOUSE_DENIED**: Warehouse denied exchange
- **EXCHANGE_COMPLETED**: Exchange processed successfully
- **INVOICING_PENDING**: Awaiting invoice generation
- **INVOICED**: Invoice generated and sent
- **CLOSED**: Ticket fully resolved
- **ESCALATED**: SLA breach or special handling required

### Ticket Status
- **NEW**: Recently created ticket
- **IN_PROCESS**: Currently being handled
- **COMPLETED**: Successfully resolved
- **DENIED**: Request denied
- **ESCALATED**: Requires management intervention

## 👥 User Roles & Permissions

### Admin
- ✅ Full access to all modules
- ✅ User management and role assignment
- ✅ System configuration and settings
- ✅ Advanced reporting and analytics

### Support
- ✅ Create and edit exchange tickets
- ✅ View all ticket information
- ✅ Communicate with customers
- ✅ Generate basic reports

### Warehouse
- ✅ Process warehouse operations
- ✅ Approve/deny exchange requests
- ✅ Manage inventory
- ✅ Update ticket statuses

### Invoicing
- ✅ Generate and manage invoices
- ✅ Track payments
- ✅ Financial reporting
- ✅ Billing operations

## 🗂️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── Layout.tsx      # Main application layout
├── pages/              # Page components
│   ├── Dashboard/      # Main dashboard with KPIs
│   ├── ExchangeLodging/ # Ticket creation and management
│   ├── Warehouse/      # Warehouse operations
│   ├── Invoicing/      # Invoicing interface
│   ├── TicketDetail/   # Individual ticket view
│   ├── Users.tsx       # User management
│   └── Login.tsx       # Authentication
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Authentication logic
│   ├── useTickets.ts   # Ticket data management
│   └── useUsers.ts     # User management
├── contexts/           # React contexts
│   └── UserContext.ts  # User state management
├── types/              # TypeScript type definitions
│   └── database.ts     # Database schema types
├── lib/                # Utility functions
├── utils/              # Helper functions
└── integrations/       # External integrations
```

## 🗃️ Database Schema

### Core Tables

#### Tickets
- Primary table for exchange requests
- Contains customer information, items, and workflow status
- Tracks timestamps for each stage transition

#### Ticket Events
- Audit trail for all ticket activities
- Records who did what and when
- Essential for compliance and debugging

#### Product Catalog
- Master list of available products
- Includes SKUs, variants, and school tags
- Supports inventory management

#### Profiles
- User management and authentication
- Role-based access control
- User preferences and settings

## 🔧 Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd exchange-flow-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

4. **Set up database**
   - Create a new Supabase project
   - Run the SQL migration scripts (see `readme/NEW-SETUP.md`)
   - Configure authentication settings

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open http://localhost:5173
   - Log in with your Supabase credentials

## 📈 Key Performance Indicators

The dashboard tracks important metrics:

- **Total Open Tickets**: Active tickets across all stages
- **Pending Warehouse**: Tickets awaiting warehouse processing
- **Pending Invoicing**: Tickets ready for invoicing
- **SLA Breached**: Tickets exceeding time limits
- **Completed This Week**: Successfully resolved tickets
- **Denied Tickets**: Rejected exchange requests

## 🔐 Security Features

- **Role-Based Access Control**: Users only see relevant modules
- **Authentication**: Secure login via Supabase Auth
- **Data Validation**: Form validation with Zod schemas
- **Audit Trail**: Complete activity logging
- **SLA Monitoring**: Automated escalation for overdue tickets

## 📱 Responsive Design

- Mobile-first approach with Tailwind CSS
- Responsive layouts for tablets and desktops
- Touch-friendly interface elements
- Consistent user experience across devices

## 🔄 Integration Capabilities

### Google Sheets Integration
- Product catalog synchronization
- Automated data import/export
- Custom reporting capabilities
- (See `readme/google-sheets-integration.md` for details)

### External Systems
- ERP system integration possibilities
- Payment gateway connectivity
- Email notification systems
- SMS alert capabilities

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify Supabase credentials in `.env`
   - Check Supabase project status
   - Ensure tables are created

2. **Authentication Issues**
   - Clear browser cache and cookies
   - Verify Supabase auth configuration
   - Check user role assignments

3. **Performance Issues**
   - Monitor database query performance
   - Check React Query caching
   - Verify network connectivity

## 📚 Additional Documentation

- `readme/original-README.md` - Original project documentation
- `readme/NEW-SETUP.md` - Detailed database setup guide
- `readme/google-sheets-integration.md` - Google Sheets integration options

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary and confidential to the organization.

## 📞 Support

For technical support or questions:
- Contact the development team
- Check the troubleshooting section
- Review the additional documentation in the `readme/` folder

---

**Last Updated**: January 2026
**Version**: 1.0.0

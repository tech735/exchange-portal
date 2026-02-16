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
- **Routing**: React Router DOM (v6)
- **Forms**: React Hook Form with Zod validation
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Payments**: Razorpay Integration (Payment Links)

## 📋 Core Features

### 1. **Multi-Role Access Control**
- **Admin**: Full system access, user management, and ticket deletion
- **Support**: Create, manage, and track exchange tickets
- **Warehouse**: Process returns, QC checks, and ship exchanges
- **Invoicing**: Manage payments, refunds, and final ticket closure

### 2. **Advanced Ticket Management**
- **Exchange Logic**: Automated calculation of exchange value (Net Amount)
- **Payment Handling**: 
  - "Mark Ass Collected" for positive values
  - "Send Payment Link" integration
  - "Send to Refund" for negative values (refunds due)
- **Status Tracking**: Granular tracking from Lodging to Closure
- **SLA Monitoring**: Breach alerts and escalation

### 3. **Comprehensive Warehouse Flow**
- **Five-Stage Processing**:
  - **New**: Incoming tickets (Paid or Refunded)
  - **Return Pending**: AWB generated, waiting for pickup
  - **Return Received**: Items received at warehouse
  - **QC Processing**: Approve or Deny based on item condition
  - **Exchange Booked**: Outbound shipment booked
- **Aggregator Integration**: Direct links to ShipDelight, iThink Logistics, and ShipRocket
- **QC Actions**: Detailed approval/denial workflows with notes

### 4. **Financial Operations**
- **Invoicing**: Generate invoices for completed exchanges
- **Refund Management**: 
  - Visual "Refund Due" indicators
  - "Mark as Refunded" workflow with status tracking
  - Automated Payment Summary updates
- **Payment Reconciliation**: Track collected vs refunded amounts

### 5. **Product Management**
- Product catalog with SKU management
- School-specific product tagging
- Price management system
- Inventory tracking

### 6. **Global Search**
- **Smart Navigation**: Instant access to tickets by Order ID or Customer Name
- **Recent History**: Quick access to previously searched terms
- **Live Results**: Real-time search suggestions with ticket details
- **Keyboard Support**: Full keyboard navigation for power users

## 🔄 Application Workflow

### 1. **Ticket Creation & Lodging (Support)**
```
Customer Request → Ticket Created → Payment/Refund check → Status: LODGED
```
- Support creates ticket with exchange details.
- System calculates Net Amount:
  - **Positive**: Customer pays (Payment Link or Cash).
  - **Negative**: Refund due to customer.
- Ticket moves to `IN_PROCESS`.
- Once Payment Collected or Refund Marked, ticket moves to **Warehouse**.

### 2. **Warehouse Processing (Warehouse)**
```
New → Return Pending → Received → QC Check → Exchange Booked
```
1.  **New**: View paid/refunded tickets. Select Aggregator (ShipDelight/iThink/ShipRocket) to generate Pickup AWB.
2.  **Return Pending**: Track pickup status. Mark as "Received" when item arrives.
3.  **Return Received**: Perform QC (Quality Check).
    - **Approve**: Move to Exchange Booking.
    - **Deny**: Close ticket or request info.
4.  **Exchange Booked**: Book outbound shipment for approved items.

### 3. **Invoicing & Closure (Invoicing)**
```
EXCHANGE_BOOKED → INVOICING_PENDING → INVOICED → CLOSED
```
- Invoicing team sees completed exchanges.
- Generates Invoice.
- **For Refunds**: If `Refund Due`, clicks "Mark as Refunded". Status updates to `Refunded`.
- **Closure**: Closes ticket once all financial and physical actions are complete.

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
- **TO_BE_REFUNDED**: Refund processing required
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
- ✅ Product catalog management

### Support
- ✅ Create and edit exchange tickets
- ✅ View all ticket information
- ✅ Communicate with customers
- ✅ Generate basic reports
- ✅ Track ticket progress

### Warehouse
- ✅ Process warehouse operations
- ✅ Approve/deny exchange requests
- ✅ Manage inventory
- ✅ Update ticket statuses
- ✅ AWB tracking management

### Invoicing
- ✅ Generate and manage invoices
- ✅ Track payments
- ✅ Financial reporting
- ✅ Billing operations
- ✅ Refund processing

## 🗂️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── Layout.tsx      # Main application layout
│   ├── GlobalSearch.tsx # Global search component
│   ├── AWBFormDialog.tsx # AWB tracking dialog
│   ├── ErrorBoundary.tsx # Error handling
├── pages/              # Page components
│   ├── Dashboard/      # Main dashboard with KPIs
│   ├── ExchangeLodging/ # Ticket creation and management
│   ├── Warehouse/      # Warehouse operations
│   ├── Invoicing/      # Invoicing interface
│   ├── TicketDetail/   # Individual ticket view
│   ├── Users.tsx       # User management
│   ├── Index/          # Home page
│   ├── auth_screens/   # Authentication screens
│   └── NotFound.tsx    # 404 page
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Authentication logic
│   ├── useTickets.ts   # Ticket data management
│   ├── useProducts.ts  # Product management
│   ├── useProductPrices.ts # Price management
│   ├── use-mobile.tsx  # Mobile detection
│   └── use-toast.ts   # Toast notifications
├── contexts/           # React contexts
│   └── UserContext.ts  # User state management
├── types/              # TypeScript type definitions
│   └── database.ts     # Database schema types
├── lib/                # Utility functions
├── utils/              # Helper functions
└── integrations/       # External integrations
    └── supabase/       # Supabase configuration
```

## 🗃️ Database Schema

### Core Tables

#### Profiles
- User management and authentication
- Role-based access control (ADMIN, SUPPORT, WAREHOUSE, INVOICING)
- User preferences and settings

#### Tickets
- Primary table for exchange requests
- Contains customer information, items, and workflow status
- Tracks timestamps for each stage transition
- AWB tracking for shipments

#### Ticket Events
- Audit trail for all ticket activities
- Records who did what and when
- Essential for compliance and debugging

#### Product Catalog
- Master list of available products
- Includes SKUs, variants, and school tags
- Supports inventory management
- Price information

#### Refunds
- Financial refund tracking
- Links to tickets requiring refunds
- Status and amount tracking

## 🔧 Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### Installation Steps

1. **Clone repository**
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
   - Run SQL migration scripts from `supabase/migrations/`
   - Configure authentication settings

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access application**
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
- **Row Level Security**: Database-level access control

## 📱 Responsive Design

- Mobile-first approach with Tailwind CSS
- Responsive layouts for tablets and desktops
- Touch-friendly interface elements
- Collapsible sidebar for mobile devices
- Consistent user experience across devices

## 🔄 Integration Capabilities

### Google Sheets Integration
- Product catalog synchronization
- Automated data import/export
- Custom reporting capabilities

### External Systems
- ERP system integration possibilities
- Payment gateway connectivity
- Email notification systems
- SMS alert capabilities
- AWB tracking integration

## 🎨 UI/UX Features

- **Modern Interface**: Clean, professional design with shadcn/ui
- **Dark/Light Mode**: Theme switching capability
- **Interactive Tables**: Sortable, filterable data tables
- **Real-time Updates**: Live status updates
- **Export Functionality**: CSV and Excel export options
- **Toast Notifications**: Non-intrusive user feedback
- **Loading States**: Skeleton loaders and progress indicators

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify Supabase credentials in `.env`
   - Check Supabase project status
   - Ensure tables are created via migrations

2. **Authentication Issues**
   - Clear browser cache and cookies
   - Verify Supabase auth configuration
   - Check user role assignments

3. **Performance Issues**
   - Monitor database query performance
   - Check React Query caching
   - Verify network connectivity

4. **Build Issues**
   - Ensure all dependencies are installed
   - Check TypeScript configuration
   - Verify environment variables

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Preview Build
```bash
npm run preview
```

### Environment Variables for Production
- All environment variables from development
- Additional production-specific configurations
- Supabase production credentials

## 🤝 Contributing

1. Fork repository
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
- Review the Supabase dashboard for database issues

---

**Last Updated**: February 2026
**Version**: 1.0.0

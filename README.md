# Mira Mar Leads - Analytics Dashboard

A password-protected Next.js analytics dashboard for Mira Mar luxury real estate CRM, powered by Spark.re API.

## Version 1.5.1

Current features include comprehensive data filtering, marketing analytics with UTM tracking, and optimized API performance.

## Features

- **Password Protection**: Secure access with HTTP-only cookie sessions
- **Real-time Analytics**: Live data from Spark.re CRM (Project ID: 2855)
- **Comprehensive Filtering**: Exclude sources (Agent Import, No Value, etc.), filter agents, save presets
- **Accurate Lead Counts**: Shows ALL leads by source with engagement rates
- **UTM Tracking**: Full marketing attribution with source, medium, and campaign tracking
- **6 Dashboard Views**:
  - **Overview**: Key metrics, activity timeline, lead sources, agent distribution, ZIP code analysis
  - **Pipeline**: Sales funnel, lead attribution, conversion tracking
  - **Contacts**: Contact list, quality metrics, performance tables
  - **Engagement**: Interaction breakdown, response times, key insights
  - **Marketing**: UTM tracking, traffic sources, top campaigns
  - **Team**: Team member performance and activity
- **Dark Mode**: Toggle with localStorage persistence
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Beautiful Charts**: Recharts integration with smooth animations

## Tech Stack

- **Framework**: Next.js 15.5.7 (App Router)
- **Language**: TypeScript 5.9.3
- **React**: 19.2.1
- **Styling**: Tailwind CSS 4.1.14
- **Charts**: Recharts 3.2.1
- **Icons**: lucide-react 0.545.0
- **API**: Spark.re REST API v2

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
SPARK_API_KEY=your_spark_api_key_here
DASHBOARD_PASSWORD=your_password_here
SESSION_SECRET=your_32_char_secret_here
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
miramar-dashboard/
├── app/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   ├── dashboard/     # Dashboard data endpoint (with caching)
│   │   └── test/          # API connection test
│   ├── login/             # Login page
│   ├── about/             # About page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main dashboard page
│   └── globals.css        # Global styles
├── components/
│   ├── DashboardLayout.tsx  # Dashboard shell with header/nav
│   ├── DateRangePicker.tsx  # Date range selector
│   ├── FilterPanel.tsx      # Filter slide-out panel
│   └── tabs/
│       ├── OverviewTab.tsx
│       ├── PipelineTab.tsx
│       ├── ContactsTab.tsx
│       ├── EngagementTab.tsx
│       ├── MarketingTab.tsx
│       └── TeamTab.tsx
├── lib/
│   ├── spark-client.ts    # Spark.re API client with pagination
│   ├── filter-context.tsx # Global filter state management
│   ├── types.ts           # TypeScript types
│   └── auth.ts            # Authentication utilities
├── middleware.ts          # Route protection
└── public/
    └── logo.png           # Mira Mar logo
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with password
- `POST /api/auth/logout` - Logout and clear session

### Dashboard Data

- `GET /api/dashboard` - Fetch all dashboard analytics
  - Query params: `start`, `end`, `excludeSources`, `excludeAgents`, `excludeNoSource`
- `GET /api/test` - Test Spark.re API connection

## Performance Optimizations

- **30-minute cache**: Reduces API calls for repeated views
- **7-day default range**: Minimizes initial data fetch
- **Batch size 50**: Faster concurrent contact fetching
- **Automatic pagination**: Fetches all data without missing records

## Security Notes

- All routes protected by middleware except `/login` and `/api/auth/*`
- Session cookies are HTTP-only (not accessible via JavaScript)
- Cookies are Secure in production (HTTPS only)
- API key never exposed to client
- Password validation happens server-side only

## Build for Production

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPARK_API_KEY` | Spark.re API authentication key | Yes |
| `DASHBOARD_PASSWORD` | Password for dashboard access | Yes |
| `SESSION_SECRET` | Secret for session encryption (32+ chars) | Yes |

## Documentation

- **CLAUDE.md**: Comprehensive development guide and API patterns
- **CHANGELOG.md**: Detailed version history
- **SPARK_API_REQUEST.md**: Spark API feature requests and limitations

## License

Proprietary - Mira Mar Internal Use Only

## Support

For issues or questions, contact the development team.

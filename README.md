# Mira Mar Leads - Analytics Dashboard

A password-protected Next.js analytics dashboard for Mira Mar luxury real estate CRM, powered by Spark.re API.

## Version 1.1.0 - Lead Source Fix

**🎯 Major Update:** Fixed lead source counts to match Spark.re UI exactly!

- **Before:** Dashboard showed 43 Website leads (only engaged contacts)
- **After:** Dashboard shows 81 Website leads (ALL contacts, matching Spark UI)
- **Fix:** Implemented spark-mcp v1.6.1 pattern for accurate total lead counts
- **Impact:** Now tracks ALL leads generated for marketing ROI, not just contacted ones

See [SPARK_API_FIX.md](SPARK_API_FIX.md) for technical details.

## Features

- **Password Protection**: Secure access with HTTP-only cookie sessions
- **Real-time Analytics**: Live data from Spark.re CRM (Project ID: 2855)
- **Accurate Lead Counts**: Shows ALL leads by source (v1.1.0 fix)
- **Engagement Metrics**: Total leads + engagement rates for each source
- **5 Dashboard Views**:
  - **Overview**: Key metrics, activity timeline, lead sources with engagement
  - **Pipeline**: Sales funnel, lead attribution, conversion tracking
  - **Contacts**: Contact list, quality metrics, performance tables
  - **Engagement**: Interaction breakdown, response times, key insights
  - **About**: Dashboard information and version details
- **Dark Mode**: Toggle with localStorage persistence
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Beautiful Charts**: Recharts integration with smooth animations

## Tech Stack

- **Framework**: Next.js 15.5.5 (App Router)
- **Language**: TypeScript 5.9.3
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
DASHBOARD_PASSWORD=miramar2025
NEXTAUTH_SECRET=4a8f3e2b-9c1d-4e5a-b3f7-8d2c1a9e6b4f
```

**Important**: Replace `your_spark_api_key_here` with your actual Spark.re API key.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Login

- Navigate to `/login`
- Enter password: `miramar2025` (or your custom password from `.env.local`)
- You'll be redirected to the dashboard

## Project Structure

```
miramar-dashboard/
├── app/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   ├── dashboard/     # Dashboard data endpoint
│   │   └── test/          # API connection test
│   ├── login/             # Login page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main dashboard page
│   └── globals.css        # Global styles
├── components/
│   ├── DashboardLayout.tsx  # Dashboard shell with header/nav
│   └── tabs/
│       ├── OverviewTab.tsx
│       ├── ContactsTab.tsx
│       ├── EngagementTab.tsx
│       └── TeamTab.tsx
├── lib/
│   ├── spark-client.ts    # Spark.re API client
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
- `GET /api/test` - Test Spark.re API connection

## Features Detail

### Authentication System

- Password-based login (configurable via environment variable)
- HTTP-only cookies for session management
- Automatic redirect to login for unauthenticated users
- Middleware-based route protection

### Dashboard Analytics

All data is fetched from Spark.re API for Project ID 2855:

- **Contacts**: Total count, email coverage, agent percentage
- **Interactions**: Activity timeline, type breakdown, team performance
- **Lead Sources**: **ALL leads** by source (v1.1.0), engagement rates, quality scores
  - Shows total leads generated (not just engaged)
  - Displays engagement percentage (how many have been contacted)
  - Matches Spark.re UI counts exactly
- **Sales Pipeline**: Funnel visualization, rating distribution, source attribution
- **Top Contacts**: Most engaged contacts by interaction count

### Lead Source Data (v1.1.0 Implementation)

The dashboard now fetches **ALL contacts** per registration source using the proven spark-mcp v1.6.1 pattern:

1. Fetches ALL contacts by `registration_source_id` (not just those with interactions)
2. Filters by project using `projects` array (individual contact fetch)
3. Batches requests (20 at a time) for performance
4. Shows total leads + engagement rate (% contacted)

**Example Output:**
```
Website: 81 total leads (53% engagement)
  - 43 contacts contacted
  - 38 contacts never contacted (now visible!)
```

This is critical for marketing ROI tracking - you need to see ALL leads generated, even if sales hasn't contacted them yet.

### Dark Mode

- Toggle button in header (☀️/🌙)
- Preference saved to localStorage
- Smooth transitions between themes
- Respects system color scheme on first load

### Responsive Design

- Mobile-first approach
- Breakpoints: 375px, 768px, 1440px
- Horizontal scroll for tabs on mobile
- Adaptive chart sizes
- Touch-friendly interface

## Build for Production

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SPARK_API_KEY` | Spark.re API authentication key | Required |
| `DASHBOARD_PASSWORD` | Password for dashboard access | `miramar2025` |
| `NEXTAUTH_SECRET` | Secret for session encryption | Required |

## Security Notes

- All routes protected by middleware except `/login` and `/api/auth/*`
- Session cookies are HTTP-only (not accessible via JavaScript)
- Cookies are Secure in production (HTTPS only)
- API key never exposed to client
- Password validation happens server-side only

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### "SPARK_API_KEY not configured" error

Make sure your `.env.local` file exists and contains a valid API key.

### Charts not rendering

Ensure `recharts` is installed: `npm install recharts`

### Dark mode not persisting

Check browser localStorage permissions and console for errors.

### Login redirect loop

Clear cookies and try again. Check that `NEXTAUTH_SECRET` is set.

## License

Proprietary - Mira Mar Internal Use Only

## Support

For issues or questions, contact the development team.

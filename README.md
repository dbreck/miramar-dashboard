# Mira Mar Leads - Analytics Dashboard

A password-protected Next.js analytics dashboard for Mira Mar luxury real estate CRM, powered by Spark.re API.

## Features

- **Password Protection**: Secure access with HTTP-only cookie sessions
- **Real-time Analytics**: Live data from Spark.re CRM (Project ID: 2855)
- **4 Dashboard Views**:
  - **Overview**: Key metrics, activity timeline, interaction types, top contacts
  - **Contacts**: Lead source distribution, quality metrics, performance tables
  - **Engagement**: Interaction breakdown, response times, key insights
  - **Team**: Team member performance, workload distribution
- **Dark Mode**: Toggle with localStorage persistence
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Beautiful Charts**: Recharts integration with smooth animations

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: lucide-react
- **API**: Spark.re REST API

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
- **Lead Sources**: Distribution, quality metrics, engagement rates
- **Top Contacts**: Most engaged contacts by interaction count

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

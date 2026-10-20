# RenderMonitor — your own uptime monitoring platform

An UptimeRobot-inspired MVP built with Next.js, Supabase, Python, and GitHub Actions.

> **Reliability note:** GitHub Actions is a best-effort scheduler, not a real-time monitoring network. Runs may be delayed. Do not market this as guaranteed uptime.

## 55 implemented project contributions
1. Multi-monitor workspace; 2. email sign-up; 3. email sign-in; 4. sign-out; 5. user-scoped data; 6. Supabase RLS; 7. persistent monitor config; 8. create monitor; 9. edit monitor; 10. delete monitor; 11. pause monitor; 12. resume monitor; 13. configurable interval; 14. public HTTP/HTTPS validation; 15. URL test endpoint; 16. private IPv4 blocking; 17. localhost blocking; 18. private IPv6 basic blocking; 19. DNS checks before test requests; 20. request timeout; 21. HTTP status recording; 22. latency measurement; 23. scheduled worker; 24. due-time selection; 25. bounded checks per run; 26. persisted history; 27. latest status; 28. operational summary; 29. incident summary; 30. recent success-rate summary; 31. search by name/URL; 32. status filters; 33. paused filter; 34. selected monitor details; 35. response-time average; 36. recent success percentage; 37. check outcome bars; 38. activity feed; 39. CSV export; 40. responsive sidebar; 41. responsive table; 42. add modal; 43. edit modal; 44. URL test feedback; 45. loading states; 46. error notices; 47. empty states; 48. accessible form labels; 49. CI workflow; 50. Python tests; 51. environment template; 52. SQL schema/indexes; 53. deployment docs; 54. service-role key stays server-side; 55. scheduler concurrency protection.

## Setup

### 1. Supabase
Create a project at https://supabase.com, then run `supabase/schema.sql` in SQL Editor.

### 2. Next.js
```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Open http://localhost:3000 and create an account.

### 3. Scheduler secrets
Add repository Actions secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS: never put it in a `NEXT_PUBLIC_` variable or commit it. Manually run Actions → Monitor scheduler to test.

### 4. Deploy
Import the repo into Vercel and add the two `NEXT_PUBLIC_` variables. The database stores history; Vercel does not need local persistence.

### 5. Tests
Run `npm run test:python`, `npm run lint`, and `npm run build`. CI runs Python tests and a Next.js build.

## Production hardening
This is an MVP. Before allowing untrusted users at scale, add DNS-rebinding-resistant egress controls, rate limits, abuse prevention, database-enforced monitor quotas, incident deduplication, notifications, scheduler fairness, data retention, and independent probes. The URL test endpoint has basic private-host checks but is not a complete production SSRF defense. A five-minute GitHub cron is a target, not a guarantee.

The original single-URL `health-check.yml` workflow remains available; multi-monitor checks use `monitor-scheduler.yml`.

## License
MIT
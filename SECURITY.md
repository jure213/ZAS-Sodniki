# Security Notes

## Environment Variables

This project uses environment variables to manage sensitive credentials.

### Development Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual credentials in `.env`:
   ```
   SUPABASE_URL=your_actual_supabase_url
   SUPABASE_ANON_KEY=your_actual_supabase_anon_key
   ```

### Production Builds

The `.env` file is included in the packaged application. **Important security considerations:**

1. **Never commit `.env` to version control** - it's already in `.gitignore`
2. **Rotate keys regularly** in Supabase dashboard
3. **Use Row Level Security (RLS)** policies in Supabase to protect data
4. **The anon key is meant to be public-facing**, but should still be secured

### GitHub Token

The `GH_TOKEN` in `.env` is used for electron-builder auto-updates. Keep it secret and rotate if exposed.

## Best Practices

- Review Supabase RLS policies regularly
- Monitor Supabase dashboard for unusual activity
- Consider using service role keys only on backend/secure environments
- For open source projects, document which keys users need to provide

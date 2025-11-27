# Mesaj Loglama Migration'ı Çalıştırma

## Migration Dosyası
`supabase/migrations/create_message_log_function.sql`

## Yöntem 1: Supabase Dashboard (Önerilen)

1. [Supabase Dashboard](https://app.supabase.com) → Projenize gidin
2. Sol menüden **SQL Editor**'ı açın
3. Aşağıdaki SQL kodunu kopyalayıp SQL Editor'a yapıştırın:

```sql
-- Create function to log messages to Supabase PostgreSQL logs
-- This function will be called when a message is sent
-- Messages are already stored in the 'messages' table, this function only logs to PostgreSQL logs
-- which are visible in Supabase dashboard under Logs section
CREATE OR REPLACE FUNCTION public.log_message(
  p_message_id uuid,
  p_room_id uuid,
  p_sender_id uuid,
  p_receiver_id uuid,
  p_content text,
  p_created_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log to PostgreSQL log (visible in Supabase dashboard > Logs)
  -- This does NOT create a duplicate table, it only writes to PostgreSQL logs
  RAISE LOG 'MESSAGE_SENT: message_id=%, room_id=%, sender_id=%, receiver_id=%, content=%, created_at=%', 
    p_message_id, 
    p_room_id, 
    p_sender_id, 
    p_receiver_id, 
    LEFT(p_content, 200), 
    p_created_at;
END;
$$;
```

4. **Run** butonuna tıklayın
5. Başarılı mesajını görmelisiniz

## Yöntem 2: Supabase CLI

Eğer Supabase CLI kuruluysa:

```bash
supabase db push
```

## Kontrol

Migration başarılı olduktan sonra:

1. Supabase Dashboard → **Database** → **Functions** bölümüne gidin
2. `log_message` fonksiyonunu görmelisiniz
3. Artık mesaj gönderildiğinde Supabase Dashboard → **Logs** bölümünde mesajlar görünecek

## Not

- Bu migration sadece bir log fonksiyonu oluşturur
- Yeni bir tablo oluşturmaz (mesajlar zaten `messages` tablosunda)
- Mesaj gönderme işlemi migration olmadan da çalışır, sadece loglama olmaz


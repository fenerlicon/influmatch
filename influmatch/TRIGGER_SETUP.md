# Trigger Oluşturma - Manuel Yöntem

Eğer SQL ile trigger oluşturamıyorsanız, Supabase Dashboard'dan manuel olarak oluşturabilirsiniz.

## Yöntem 1: Supabase Dashboard'dan Manuel Oluşturma

1. **Supabase Dashboard** → **Database** → **Triggers** sekmesine gidin
2. **"Create a new trigger"** butonuna tıklayın
3. Formu doldurun:
   - **Name:** `on_auth_user_created`
   - **Table:** `auth.users` (dropdown'dan seçin)
   - **Function:** `handle_new_auth_user` (dropdown'dan seçin)
   - **Events:** `INSERT` seçin
   - **Orientation:** `ROW` seçin
   - **Timing:** `AFTER` seçin
   - **Enabled:** ✅ Açık
4. **"Save"** butonuna tıklayın

## Yöntem 2: SQL ile (Alternatif Syntax)

Eğer hata alıyorsanız, şu SQL'i deneyin:

```sql
-- Önce mevcut trigger'ı sil (varsa)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger'ı oluştur
CREATE TRIGGER on_auth_user_created
  AFTER INSERT
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
```

## Yöntem 3: PostgreSQL 11+ Syntax (Supabase genelde bu)

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
```

## Kontrol

Trigger oluşturulduktan sonra:
1. **Database** → **Triggers** sekmesine gidin
2. `on_auth_user_created` trigger'ını görmelisiniz
3. **ENABLED** sütununda yeşil tik olmalı

## Sorun Giderme

### Hata: "function does not exist"
- Önce `handle_new_auth_user` function'ının var olduğundan emin olun
- Functions sekmesinde kontrol edin

### Hata: "permission denied"
- Supabase Dashboard'dan çalıştırıyorsanız bu hata olmamalı
- Eğer oluyorsa, service role key kullanarak deneyin

### Hata: "syntax error"
- PostgreSQL sürümüne göre `EXECUTE FUNCTION` veya `EXECUTE PROCEDURE` kullanın
- Supabase genelde PostgreSQL 15+ kullanır, `EXECUTE FUNCTION` doğru olmalı


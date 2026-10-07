-- Realtime yayını (2026-10-07, canlıda uygulandı).
-- Yayında yalnızca messages vardı; teklif, başvuru, oda, bildirim, destek ve rozet ekranlarındaki
-- canlı dinleyicilere hiç olay gelmiyordu (yeni kayıtlar ancak sayfa yenilenince görünüyordu).
-- Eklenen tabloların hepsinde RLS açık ve kolon bazlı gizleme yok; Realtime olayları kullanıcının
-- RLS'ine göre süzer. users tablosu BİLEREK eklenmedi: kolon bazlı gizli alanları var ve Realtime
-- satırın tamamını gönderir.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['offers','advert_applications','rooms','dismissed_offers','notifications','support_tickets','message_reports','user_badges']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

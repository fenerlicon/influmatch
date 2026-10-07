-- ==============================================================================
-- 5. ROLES & ADMIN CHECKS: DEEP SECRETS 
-- ==============================================================================

-- ====================
-- BADGES (Rozetler) Table
-- AÇIK: İsteyen kişi INSERT fonksiyonunu okuyarak API üzerinden kendisine
-- "1M Follower", "Onaylı Marka" gibi bütün rozetleri atayabilir.
-- ====================
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;

-- Yeni Kural: Rozetleri YALNIZCA yöneticiler (admin) insert edebilir, kullanıcı KENDİ KENDİNE ROZET TAKAMAZ.
CREATE POLICY "Users can insert their own badges"
  ON public.user_badges
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin')
    )
  );


-- ====================
-- SUPPORT TICKETS (Destek Biletleri) Table
-- AÇIK: Kullanıcı bilet açarken "admin_response" gönderebilir ve admin rolü yapabilirdi.
-- Normalde RLS var ancak Insert anında admin_response engellenmemişti!
-- ====================
CREATE OR REPLACE FUNCTION public.restrict_support_tickets_insert_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Bilet yaratan kişi Admin değilse
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.admin_response = NULL; -- Asla baştan admini taklit edemez!
            NEW.status = 'open';       -- Mecburi 'open' olarak açmak zorundadır!
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_support_tickets_insert_trigger ON public.support_tickets;

CREATE TRIGGER restrict_support_tickets_insert_trigger
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.restrict_support_tickets_insert_columns();


-- ====================
-- REVIEWS/FEEDBACKS (Uygulama İçi İnceleme / Bildirim) Tablosu
-- AÇIK: Destek biletleriyle aynı şekilde kullanıcı feedback yaratırken admin değerlerini ezebiliyordu
-- ====================
CREATE OR REPLACE FUNCTION public.restrict_feedback_submissions_insert_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Normal kullanıcı feedback yaratırken
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.admin_notes = NULL; 
            NEW.status = 'pending';  -- Mutlaka pending kalmalı
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_feedback_insert_trigger ON public.feedback_submissions;

CREATE TRIGGER restrict_feedback_insert_trigger
BEFORE INSERT ON public.feedback_submissions
FOR EACH ROW
EXECUTE FUNCTION public.restrict_feedback_submissions_insert_columns();

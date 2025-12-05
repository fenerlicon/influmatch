import { NextIntlClientProvider, useMessages } from 'next-intl';
import { Inter } from 'next/font/google';
import SupabaseProvider from '@/components/providers/SupabaseProvider';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function LocaleLayout({
    children,
    params: { locale }
}: {
    children: React.ReactNode;
    params: { locale: string };
}) {
    const messages = useMessages();

    return (
        <html lang={locale}>
            <body className={`${inter.className} bg-background text-white antialiased`}>
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <SupabaseProvider>{children}</SupabaseProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}

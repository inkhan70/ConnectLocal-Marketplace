
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Loader2 } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

const allAddresses = [
  { country: "Afghanistan", countryCode: "AF", lines: ["cluster lab", "Street 14, Wazir Akbar Khan", "Kabul 1001", "Afghanistan"] },
  { country: "Argentina", countryCode: "AR", lines: ["cluster lab", "Av. Leandro N. Alem 550", "C1001 Buenos Aires", "Argentina"] },
  { country: "Australia", countryCode: "AU", lines: ["cluster lab", "1 Constitution Avenue", "Canberra ACT 2601", "Australia"] },
  { country: "Bangladesh", countryCode: "BD", lines: ["cluster lab", "Plot 76, Sector 7", "Dhaka 1207", "Bangladesh"] },
  { country: "Brazil", countryCode: "BR", lines: ["cluster lab", "SHS Quadra 3, Bloco A", "Brasília - DF, 70333-900", "Brazil"] },
  { country: "Canada", countryCode: "CA", lines: ["cluster lab", "99 Bank Street, Suite 500", "Ottawa, ON K1P 1A1", "Canada"] },
  { country: "China", countryCode: "CN", lines: ["cluster lab", "1 Guanghua Road, Chaoyang District", "Beijing 100020", "China"] },
  { country: "Egypt", countryCode: "EG", lines: ["cluster lab", "35 Ramses Street", "Cairo 11511", "Egypt"] },
  { country: "Ethiopia", countryCode: "ET", lines: ["cluster lab", "Africa Avenue, Bole Sub-City", "Addis Ababa 1230", "Ethiopia"] },
  { country: "France", countryCode: "FR", lines: ["cluster lab", "41 Avenue de l'Opéra", "75002 Paris", "France"] },
  { country: "Germany", countryCode: "DE", lines: ["cluster lab", "Unter den Linden 17", "10117 Berlin", "Germany"] },
  { country: "Ghana", countryCode: "GH", lines: ["cluster lab", "Liberation Link, Airport City", "Accra GA-075-8413", "Ghana"] },
  { country: "India", countryCode: "IN", lines: ["cluster lab", "Barakhamba Road, Connaught Place", "New Delhi 110001", "India"] },
  { country: "Indonesia", countryCode: "ID", lines: ["cluster lab", "Jl. Jend. Sudirman Kav. 52-53", "Jakarta 12190", "Indonesia"] },
  { country: "Iran, Islamic Republic of", countryCode: "IR", lines: ["cluster lab", "Valiasr Street, No. 250", "Tehran 19686", "Iran"] },
  { country: "Italy", countryCode: "IT", lines: ["cluster lab", "Via del Corso 156", "00186 Roma RM", "Italy"] },
  { country: "Japan", countryCode: "JP", lines: ["cluster lab", "2-11-3 Nagatacho, Chiyoda-ku", "Tokyo 100-0014", "Japan"] },
  { country: "Kenya", countryCode: "KE", lines: ["cluster lab", "Upper Hill Road, 7th Floor", "Nairobi 00100", "Kenya"] },
  { country: "Malaysia", countryCode: "MY", lines: ["cluster lab", "Level 10, Kuala Lumpur Tower", "Kuala Lumpur 50250", "Malaysia"] },
  { country: "Mexico", countryCode: "MX", lines: ["cluster lab", "Paseo de la Reforma 265", "Ciudad de México 06500", "Mexico"] },
  { country: "Morocco", countryCode: "MA", lines: ["cluster lab", "Avenue Mohammed V, Quartier des Ministères", "Rabat 10000", "Morocco"] },
  { country: "Netherlands", countryCode: "NL", lines: ["cluster lab", "De Ruijterkade 128", "1011 AC Amsterdam", "Netherlands"] },
  { country: "Nigeria", countryCode: "NG", lines: ["cluster lab", "7 Port Harcourt Crescent, Off Gimbiya Street", "Abuja 900211", "Nigeria"] },
  { country: "Pakistan", countryCode: "PK", lines: ["cluster lab", "Sector F-7, Blue Area", "Islamabad 44000", "Pakistan"] },
  { country: "Philippines", countryCode: "PH", lines: ["cluster lab", "Makati Avenue, 32nd Floor", "Manila 1200", "Philippines"] },
  { country: "Poland", countryCode: "PL", lines: ["cluster lab", "ul. Emilii Plater 28", "00-688 Warszawa", "Poland"] },
  { country: "Russian Federation", countryCode: "RU", lines: ["cluster lab", "Krasnopresnenskaya Naberezhnaya, 12", "Moscow 123100", "Russia"] },
  { country: "Saudi Arabia", countryCode: "SA", lines: ["cluster lab", "King Fahd Road, Al Olaya District", "Riyadh 12213", "Saudi Arabia"] },
  { country: "Singapore", countryCode: "SG", lines: ["cluster lab", "1 Raffles Place, #50-01", "Singapore 048616", "Singapore"] },
  { country: "South Africa", countryCode: "ZA", lines: ["cluster lab", "Church Square, Central Business District", "Pretoria 0002", "South Africa"] },
  { country: "Korea, Republic of", countryCode: "KR", lines: ["cluster lab", "132 Teheran-ro, Gangnam-gu", "Seoul 06132", "South Korea"] },
  { country: "Spain", countryCode: "ES", lines: ["cluster lab", "Paseo de la Castellana 140", "28046 Madrid", "Spain"] },
  { country: "Sweden", countryCode: "SE", lines: ["cluster lab", "Master Samuelsgatan 70", "111 21 Stockholm", "Sweden"] },
  { country: "Thailand", countryCode: "TH", lines: ["cluster lab", "1 Siam Square Soi 3, Pathum Wan", "Bangkok 10330", "Thailand"] },
  { country: "Turkey", countryCode: "TR", lines: ["cluster lab", "İskitler Cad. No:19", "Ankara 06070", "Turkey"] },
  { country: "Ukraine", countryCode: "UA", lines: ["cluster lab", "Khreshchatyk Street 15", "Kyiv 01001", "Ukraine"] },
  { country: "United Arab Emirates", countryCode: "AE", lines: ["cluster lab", "Al Maryah Island, Sowwah Square", "Abu Dhabi", "United Arab Emirates"] },
  { country: "United Kingdom", countryCode: "GB", lines: ["cluster lab", "41 Business Street", "London SW1A 1AA", "United Kingdom"] },
  { country: "United States", countryCode: "US", lines: ["cluster lab", "1600 Pennsylvania Avenue NW", "Washington, D.C. 20001", "United States"] },
  { country: "Viet Nam", countryCode: "VN", lines: ["cluster lab", "1 Lieu Giai Street, Ba Dinh District", "Hanoi 100000", "Vietnam"] },
];


export default function ContactPage() {
  const { t } = useLanguage();
  const [displayedAddresses, setDisplayedAddresses] = useState(allAddresses);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLocationAndFilter = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) {
          throw new Error('Failed to fetch location');
        }
        const data = await response.json();
        const userCountryCode = data.country_code;
        
        if (userCountryCode) {
          const matchedAddress = allAddresses.find(addr => addr.countryCode === userCountryCode);
          if (matchedAddress) {
            setDisplayedAddresses([matchedAddress]);
          } else {
            // If no match, show all addresses
            setDisplayedAddresses(allAddresses);
          }
        }
      } catch (error) {
        console.error("Could not determine user location, showing all addresses.", error);
        setDisplayedAddresses(allAddresses);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocationAndFilter();
  }, []);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter">
          {t('contact.title')}
        </h1>
        <p className="max-w-xl mx-auto text-lg text-muted-foreground mt-4">
          {t('contact.description')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail /> {t('contact.email_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('contact.email_description')}</p>
            <a href="mailto:hello@yourcompany.com" className="text-primary font-bold mt-2 block">hello@yourcompany.com</a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone /> {t('contact.phone_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('contact.phone_description')}</p>
            <p className="font-bold mt-2">+1 (555) 123-4567</p>
            <p className="text-xs text-muted-foreground mt-1">{t('contact.phone_hours')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('contact.social_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('contact.social_description')}</p>
            <div className="flex gap-4 mt-2">
              <Link href="#" aria-label="Facebook"><Facebook className="h-6 w-6 text-primary hover:text-accent"/></Link>
              <Link href="#" aria-label="Twitter"><Twitter className="h-6 w-6 text-primary hover:text-accent"/></Link>
              <Link href="#" aria-label="Instagram"><Instagram className="h-6 w-6 text-primary hover:text-accent"/></Link>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="max-w-6xl mx-auto mt-8">
        <Card className="bg-secondary/30">
          <CardHeader>
              <CardTitle>{t('contact.faq_title')}</CardTitle>
          </CardHeader>
          <CardContent>
              <p className="text-muted-foreground">
                  {t('contact.faq_description_1')} <Link href="/faq" className="text-primary font-bold underline">{t('contact.faq_link')}</Link> – {t('contact.faq_description_2')}
              </p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-12" />

      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold font-headline">{t('contact.offices_title')}</h2>
        <p className="text-muted-foreground mt-2">{t('contact.offices_description')}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4">Finding your local office...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {displayedAddresses.map((office, index) => (
            <Card key={index} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary"/>{office.country}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex-grow">
                {office.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

    
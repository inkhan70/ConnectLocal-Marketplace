
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Building, Globe, Users, Target } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";

const teamMembers = [
  {
    name: "Alex Johnson",
    role: "Founder & CEO",
    avatar: "https://picsum.photos/seed/alex/100/100",
    dataAiHint: "man portrait",
  },
  {
    name: "Maria Garcia",
    role: "Head of Product",
    avatar: "https://picsum.photos/seed/maria/100/100",
     dataAiHint: "woman portrait",
  },
  {
    name: "Chen Wei",
    role: "Lead Engineer",
    avatar: "https://picsum.photos/seed/chen/100/100",
     dataAiHint: "man smiling",
  },
  {
    name: "Fatima Al-Fassi",
    role: "Head of Marketing",
    avatar: "https://picsum.photos/seed/fatima/100/100",
    dataAiHint: "woman smiling",
  },
];


export default function AboutPage() {
  const { t } = useLanguage();
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-16">
        
        {/* --- Hero Section --- */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
            <div className="flex flex-col items-start text-left">
              <h1 className="text-4xl md:text-6xl font-extrabold font-headline leading-tight tracking-tighter text-primary">
                {t('about.hero_title')}
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground my-8">
                {t('about.hero_description')}
              </p>
            </div>
            <div className="hidden md:block">
               <Image 
                src={"https://picsum.photos/seed/abouthero/600/400"}
                alt={t('about.hero_alt')}
                width={600}
                height={400}
                className="rounded-xl shadow-2xl"
                data-ai-hint="bustling marketplace"
              />
            </div>
        </div>

        {/* --- Mission and Vision --- */}
        <div className="grid md:grid-cols-2 gap-8 text-center max-w-4xl mx-auto mb-24">
          <Card className="bg-secondary/50">
            <CardHeader>
              <Target className="h-10 w-10 mx-auto text-primary mb-2" />
              <CardTitle className="font-headline text-2xl">{t('about.mission_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('about.mission_description')}</p>
            </CardContent>
          </Card>
           <Card className="bg-secondary/50">
            <CardHeader>
              <Globe className="h-10 w-10 mx-auto text-primary mb-2" />
              <CardTitle className="font-headline text-2xl">{t('about.vision_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('about.vision_description')}</p>
            </CardContent>
          </Card>
        </div>
        
        <Separator className="my-24" />

        {/* --- Our Story Section --- */}
        <div className="max-w-3xl mx-auto text-center mb-24">
             <h2 className="text-3xl font-bold font-headline mb-4">{t('about.story_title')}</h2>
             <p className="text-muted-foreground leading-relaxed">
                {t('about.story_description')}
             </p>
        </div>
        
        {/* --- Meet the Team Section --- */}
        <div className="text-center">
            <h2 className="text-3xl font-bold font-headline mb-4">{t('about.team_title')}</h2>
            <p className="max-w-2xl mx-auto text-muted-foreground mb-12">{t('about.team_description')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8">
                {teamMembers.map((member) => (
                    <div key={member.name} className="flex flex-col items-center">
                        <Avatar className="w-24 h-24 mb-4">
                            <AvatarImage src={member.avatar} alt={member.name} data-ai-hint={member.dataAiHint} />
                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="font-semibold">{member.name}</h3>
                        <p className="text-sm text-primary">{t(member.role)}</p>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}


"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: any;
}

interface Chat {
    id: string;
    participants: string[];
    participantProfiles: {
        [uid: string]: {
            name: string;
            role: string;
        }
    };
    lastMessage: string;
    lastMessageTimestamp: any;
}

function ChatPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const initialChatId = searchParams.get('chatId');

    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- Data Fetching ---
    const chatsQuery = useMemoFirebase(() => 
        user ? query(collection(firestore, 'chats'), where('participants', 'array-contains', user.uid), orderBy('lastMessageTimestamp', 'desc')) : null,
        [user, firestore]
    );
    const { data: chats, isLoading: chatsLoading } = useCollection<Chat>(chatsQuery);

    const messagesQuery = useMemoFirebase(() => 
        activeChat ? query(collection(firestore, 'chats', activeChat.id, 'messages'), orderBy('timestamp', 'asc')) : null,
        [activeChat, firestore]
    );
    const { data: messages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
    // --- End Data Fetching ---

    useEffect(() => {
        if (initialChatId && chats) {
            const foundChat = chats.find(c => c.id === initialChatId);
            if (foundChat) {
                setActiveChat(foundChat);
            }
        } else if (!activeChat && chats && chats.length > 0) {
            // Default to the first chat if none is selected
            setActiveChat(chats[0]);
        }
    }, [initialChatId, chats, activeChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat || !user) return;

        setIsSending(true);
        try {
            const messagesColRef = collection(firestore, 'chats', activeChat.id, 'messages');
            await addDoc(messagesColRef, {
                senderId: user.uid,
                text: newMessage,
                timestamp: serverTimestamp(),
            });

            const chatDocRef = doc(firestore, 'chats', activeChat.id);
            await setDoc(chatDocRef, {
                lastMessage: newMessage,
                lastMessageTimestamp: serverTimestamp(),
            }, { merge: true });

            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };
    
    if (authLoading || chatsLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const getOtherParticipant = (chat: Chat) => {
        if (!user) return null;
        const otherId = chat.participants.find(p => p !== user.uid);
        return otherId ? chat.participantProfiles[otherId] : null;
    }

    return (
        <div className="h-[calc(100vh-10rem)] grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Conversations List */}
            <Card className="md:col-span-1 lg:col-span-1 h-full flex flex-col">
                <CardHeader>
                    <h2 className="text-xl font-bold">Conversations</h2>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <ScrollArea className="h-full">
                         {chats && chats.length > 0 ? (
                            chats.map(chat => {
                                const otherUser = getOtherParticipant(chat);
                                return (
                                <button key={chat.id} onClick={() => setActiveChat(chat)} className={cn("w-full text-left p-4 border-b hover:bg-muted/50", activeChat?.id === chat.id && "bg-muted")}>
                                    <div className="flex items-center space-x-3">
                                        <Avatar>
                                            <AvatarFallback>{otherUser?.name?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-semibold truncate">{otherUser?.name || 'Unknown User'}</p>
                                            <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                                        </div>
                                    </div>
                                </button>
                            )})
                         ) : (
                             <div className="p-4 text-center text-muted-foreground">
                                <Users className="mx-auto h-8 w-8 mb-2" />
                                No conversations yet.
                            </div>
                         )}
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Active Chat Window */}
            <Card className="md:col-span-2 lg:col-span-3 h-full flex flex-col">
                {activeChat ? (
                    <>
                        <CardHeader className="border-b">
                           <div className="flex items-center space-x-3">
                               <Avatar>
                                   <AvatarFallback>{getOtherParticipant(activeChat)?.name?.charAt(0) || 'U'}</AvatarFallback>
                               </Avatar>
                               <div>
                                   <p className="font-semibold">{getOtherParticipant(activeChat)?.name}</p>
                                   <p className="text-xs text-muted-foreground">{getOtherParticipant(activeChat)?.role}</p>
                               </div>
                           </div>
                        </CardHeader>
                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-4">
                               {messagesLoading && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>}
                                {messages && messages.map(msg => (
                                    <div key={msg.id} className={cn("flex", msg.senderId === user?.uid ? "justify-end" : "justify-start")}>
                                        <div className={cn(
                                            "max-w-xs lg:max-w-md rounded-lg px-4 py-2", 
                                            msg.senderId === user?.uid ? "bg-primary text-primary-foreground" : "bg-muted"
                                        )}>
                                            <p>{msg.text}</p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                        <div className="p-4 border-t">
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                                <Input 
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..." 
                                    autoComplete="off"
                                />
                                <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}>
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                        <MessageSquare className="h-16 w-16 mb-4" />
                        <h3 className="text-xl font-semibold">Welcome to your Chat</h3>
                        <p>Select a conversation from the left to start messaging.</p>
                        <p className="text-sm mt-4">You can start a new chat by visiting a product page and clicking the "Chat" button.</p>
                    </div>
                )}
            </Card>
        </div>
    );
}


export default function ChatPageWrapper() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <ChatPage />
        </Suspense>
    );
}

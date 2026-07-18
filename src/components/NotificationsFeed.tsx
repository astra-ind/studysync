import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, getDocs, updateDoc, doc, deleteDoc } from '../lib/firebase';
import { NotificationMsg } from '../types';
import { HardcodedUser } from '../config';
import { Bell, Send, Trash2, Zap } from 'lucide-react';

interface NotificationsFeedProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
  events: any[]; // For scanning events to make dynamic notifications
}

export default function NotificationsFeed({ currentUser, partner, events }: NotificationsFeedProps) {
  const [notifications, setNotifications] = useState<NotificationMsg[]>([]);
  const [customMsg, setCustomMsg] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Load real-time notifications
  useEffect(() => {
    const q = query(collection(db, 'notifications'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id });
      });
      // Sort by timestamp descending
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(list.slice(0, 35)); // Keep latest 35
    });

    return () => unsubscribe();
  }, []);

  // Scan events once to trigger dynamic helper notifications if none exist
  useEffect(() => {
    if (events.length === 0) return;

    const checkAndTriggerReminders = async () => {
      const now = new Date();
      
      const snap = await getDocs(collection(db, 'notifications'));
      const existingTexts = new Set<string>();
      snap.forEach((doc) => existingTexts.add(doc.data().text));

      // Check if study starts in 30 minutes
      events.forEach(async (ev) => {
        const start = new Date(ev.start);
        const diffMin = (start.getTime() - now.getTime()) / (60 * 1000);
        
        if (diffMin > 0 && diffMin <= 30) {
          const reminderText = `Reminder: "${ev.title}" starts in ${Math.round(diffMin)} minutes.`;
          if (!existingTexts.has(reminderText)) {
            await addDoc(collection(db, 'notifications'), {
              text: reminderText,
              timestamp: new Date().toISOString(),
              unread: true,
              type: 'warning',
            });
          }
        }
      });
    };

    checkAndTriggerReminders();
  }, [events]);

  const sendCustomNudge = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = customMsg.trim() || `⚡ Study Sync! ${currentUser.name} is looking to study right now!`;
    
    await addDoc(collection(db, 'notifications'), {
      text,
      timestamp: new Date().toISOString(),
      unread: true,
      type: 'alert',
    });

    setCustomMsg('');
  };

  const sendQuickNudge = async (typeStr: string) => {
    let text = '';
    if (typeStr === 'free') {
      text = `🟢 Partner Sync: ${currentUser.name} is now FREE to study!`;
    } else if (typeStr === 'studying') {
      text = `🔵 Partner Sync: ${currentUser.name} started studying! Grab your books and join!`;
    } else {
      text = `👋 Wave: ${currentUser.name} waves at you! Let's schedule a study block.`;
    }

    await addDoc(collection(db, 'notifications'), {
      text,
      timestamp: new Date().toISOString(),
      unread: true,
      type: 'info',
    });
  };

  const markAllAsRead = async () => {
    notifications.forEach(async (notif) => {
      if (notif.unread) {
        const ref = doc(db, 'notifications', notif.id);
        await updateDoc(ref, { unread: false }).catch(() => {});
      }
    });
  };

  const clearNotifications = async () => {
    notifications.forEach(async (notif) => {
      const ref = doc(db, 'notifications', notif.id);
      await deleteDoc(ref).catch(() => {});
    });
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAllAsRead();
        }}
        className="relative flex items-center justify-center p-2.5 rounded-xl border-2 border-[#D9D1C0] bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 transition-all cursor-pointer shadow-xs"
        id="notification-bell-btn"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-600 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Transparent Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border-2 border-[#D9D1C0] bg-[#FCFBF8] p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            {/* Post-it Tape visual */}
            <div className="absolute -top-3 left-1/3 right-1/3 h-5 bg-stone-200/50 backdrop-blur-xs rounded border border-stone-300/40" />

            <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3 mt-1">
              <div className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-stone-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 font-mono">Real-Time Diary Stream</h4>
              </div>
              <button
                onClick={clearNotifications}
                className="text-[10px] font-bold uppercase text-rose-700 hover:text-rose-800 transition flex items-center gap-0.5"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>

            {/* Quick Actions / Nudges */}
            <div className="my-3 p-2.5 rounded-xl bg-white border-2 border-stone-200/60 shadow-xs">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block mb-2 font-mono">
                Send Quick Nudge to {partner.name}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => sendQuickNudge('free')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-[10px] font-bold uppercase font-mono transition cursor-pointer"
                >
                  🟢 I'm Free
                </button>
                <button
                  onClick={() => sendQuickNudge('studying')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-300 text-sky-900 hover:bg-sky-100 text-[10px] font-bold uppercase font-mono transition cursor-pointer"
                >
                  🔵 Studying
                </button>
                <button
                  onClick={() => sendQuickNudge('wave')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-300 text-purple-900 hover:bg-purple-100 text-[10px] font-bold uppercase font-mono transition cursor-pointer"
                >
                  👋 Wave
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs font-serif italic text-stone-400">Ledger diary is quiet. Send a nudge!</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-2.5 rounded-xl border-2 text-xs transition-all flex flex-col justify-between ${
                      notif.unread
                        ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    <p className="text-stone-800 font-medium font-serif leading-relaxed">{notif.text}</p>
                    <span className="text-[9px] font-mono font-bold text-stone-400 block mt-1">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Custom Nudge Input */}
            <form onSubmit={sendCustomNudge} className="mt-3 pt-3 border-t-2 border-stone-200 flex gap-1.5">
              <input
                type="text"
                placeholder={`Nudge ${partner.name}...`}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800"
              />
              <button
                type="submit"
                className="p-1.5 rounded-lg bg-stone-950 text-white hover:bg-stone-800 transition flex items-center justify-center cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, where, getDocs, updateDoc, doc, deleteDoc } from '../lib/firebase';
import { NotificationMsg } from '../types';
import { USERS, HardcodedUser } from '../config';
import { Bell, Check, Trash2, Send, Zap } from 'lucide-react';

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
      setNotifications(list.slice(0, 30)); // Keep latest 30
    });

    return () => unsubscribe();
  }, []);

  // Scan events once to trigger dynamic helper notifications if none exist
  useEffect(() => {
    if (events.length === 0) return;

    const checkAndTriggerReminders = async () => {
      // Find matches or changes to generate helpful reminders if not already created
      // Let's see if we should insert some automated notifications
      const now = new Date();
      
      // Let's query notifications to avoid duplicating
      const snap = await getDocs(collection(db, 'notifications'));
      const existingTexts = new Set<string>();
      snap.forEach((doc) => existingTexts.add(doc.data().text));

      // 1. Check if study starts in 30 minutes
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
    const text = customMsg.trim() || `⚡ Study Sync Nudge! ${currentUser.name} is looking to study right now!`;
    
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
      text = `🟢 Partner Notification: ${currentUser.name} is now Free!`;
    } else if (typeStr === 'studying') {
      text = `🔵 Partner Notification: ${currentUser.name} started studying! Join in!`;
    } else {
      text = `👋 Nudge: ${currentUser.name} sent you a wave. Let's study!`;
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
        className="relative flex items-center justify-center p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        id="notification-bell-btn"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-slate-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Transparent Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-white">Study Activity Stream</h4>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearNotifications}
                  className="text-[10px] font-medium text-rose-400 hover:text-rose-300 transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Quick Actions / Nudges */}
            <div className="my-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Nudges to {partner.name}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => sendQuickNudge('free')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs transition cursor-pointer"
                >
                  🟢 I'm Free
                </button>
                <button
                  onClick={() => sendQuickNudge('studying')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 text-xs transition cursor-pointer"
                >
                  🔵 Studying
                </button>
                <button
                  onClick={() => sendQuickNudge('nudge')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-xs transition cursor-pointer"
                >
                  👋 Wave
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-500">No activity yet. Nudge your partner!</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-2.5 rounded-xl border text-xs transition flex items-start justify-between gap-2 ${
                      notif.unread
                        ? 'bg-slate-900 border-indigo-500/30 shadow-sm shadow-indigo-500/5'
                        : 'bg-slate-950/40 border-slate-900'
                    }`}
                  >
                    <div className="flex-1 space-y-1">
                      <p className="text-slate-200 leading-relaxed">{notif.text}</p>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Custom Nudge Input */}
            <form onSubmit={sendCustomNudge} className="mt-3 pt-3 border-t border-slate-900 flex gap-2">
              <input
                type="text"
                placeholder={`Send message to ${partner.name}...`}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="p-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white transition flex items-center justify-center cursor-pointer"
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

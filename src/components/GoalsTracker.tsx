import React, { useState } from 'react';
import { CustomStudyGoal } from '../types';
import { db, collection, addDoc, updateDoc, doc, deleteDoc } from '../lib/firebase';
import { HardcodedUser } from '../config';
import { Plus, Target, Check, Calendar, Trash2, Award, Zap } from 'lucide-react';
import { useToast } from './Toast';

interface GoalsTrackerProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
  goals: CustomStudyGoal[];
}

export default function GoalsTracker({ currentUser, partner, goals }: GoalsTrackerProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHours, setNewHours] = useState('5');
  const [newCategory, setNewCategory] = useState('General');
  const [newDeadline, setNewDeadline] = useState('');

  // Save new goal to Firebase
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newHours) return;

    try {
      const goalData = {
        userId: currentUser.id,
        title: newTitle.trim(),
        targetHours: parseFloat(newHours) || 5,
        currentHours: 0,
        category: newCategory.trim() || 'General',
        completed: false,
        deadline: newDeadline || undefined,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'goals'), goalData);
      
      // Post notification
      await addDoc(collection(db, 'notifications'), {
        text: `🎯 New Goal Set! ${currentUser.name} established a new target: "${newTitle}" (${newHours} hours).`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'info',
      });

      // Clear Form
      setNewTitle('');
      setNewHours('5');
      setNewCategory('General');
      setNewDeadline('');
      setIsAdding(false);
      toast(`Goal "${newTitle.trim()}" established successfully!`, 'success');
    } catch (err) {
      console.error('Error saving goal:', err);
      toast('Failed to save goal. Try again.', 'error');
    }
  };

  // Toggle Complete
  const handleToggleComplete = async (goal: CustomStudyGoal) => {
    try {
      const ref = doc(db, 'goals', goal.id);
      const isNowCompleted = !goal.completed;
      
      await updateDoc(ref, {
        completed: isNowCompleted,
        currentHours: isNowCompleted ? goal.targetHours : goal.currentHours,
      });

      if (isNowCompleted) {
        // Post notification
        await addDoc(collection(db, 'notifications'), {
          text: `🏆 Goal Completed! ${currentUser.name} nailed their goal: "${goal.title}"! Outstanding!`,
          timestamp: new Date().toISOString(),
          unread: true,
          type: 'success',
        });
        toast(`🏆 Outstanding! Goal "${goal.title}" completed!`, 'success');
      } else {
        toast(`Goal "${goal.title}" marked as active.`, 'info');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to update goal status.', 'error');
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (goalId: string) => {
    try {
      const ref = doc(db, 'goals', goalId);
      await deleteDoc(ref);
      toast('Goal deleted successfully.', 'alert');
    } catch (err) {
      console.error(err);
      toast('Failed to delete goal.', 'error');
    }
  };

  // Helper: compute percent
  const getGoalPercent = (g: CustomStudyGoal) => {
    if (g.targetHours <= 0) return 0;
    return Math.min(100, Math.round((g.currentHours / g.targetHours) * 100));
  };

  // Filter goals
  const myGoals = goals.filter((g) => g.userId === currentUser.id);
  const partnerGoals = goals.filter((g) => g.userId === partner.id);

  return (
    <div className="space-y-4">
      {/* Header and Toggle Add Button */}
      <div className="flex items-center justify-between border-b-2 border-stone-100 pb-3">
        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2 font-mono">
          <Target className="h-4 w-4 text-stone-500" />
          Synchronized Study Goals
        </h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm"
        >
          <Plus className="h-3 w-3" />
          {isAdding ? 'Close' : 'Set New Goal'}
        </button>
      </div>

      {/* Add New Goal Form Drawer */}
      {isAdding && (
        <form onSubmit={handleAddGoal} className="p-4 rounded-xl border-2 border-[#D9D1C0] bg-[#FCFBF8] space-y-3 shadow-inner animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1 font-mono">
                Goal Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Finish chemistry midterm review"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-stone-800"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1 font-mono">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Chemistry, Algebra, Coding"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-stone-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1 font-mono">
                Target Hours
              </label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-stone-800"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1 font-mono">
                Deadline (Optional)
              </label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-stone-800"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-xs"
          >
            Establish Goal Target
          </button>
        </form>
      )}

      {/* Grid of User vs Partner Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current User's Goals */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono">
            👤 Your Personal Targets ({myGoals.length})
          </p>

          <div className="space-y-2">
            {myGoals.length === 0 ? (
              <p className="text-xs font-serif italic text-stone-400 py-3 text-center bg-stone-50/40 border-2 border-dashed border-stone-200 rounded-xl">
                No active goals. Program a new target!
              </p>
            ) : (
              myGoals.map((g) => {
                const percent = getGoalPercent(g);
                return (
                  <div
                    key={g.id}
                    className={`p-3.5 rounded-xl border-2 bg-white transition shadow-xs ${
                      g.completed ? 'border-emerald-300 bg-emerald-50/10' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase font-mono px-2 py-0.5 rounded border ${
                            g.completed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}>
                            {g.category}
                          </span>
                          {g.deadline && (
                            <span className="text-[9px] text-stone-400 font-mono flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {new Date(g.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm font-bold text-stone-900 leading-snug truncate ${g.completed ? 'line-through text-stone-400' : ''}`}>
                          {g.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleComplete(g)}
                          className={`p-1 rounded-lg border transition cursor-pointer ${
                            g.completed
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-stone-50 border-stone-200 hover:bg-emerald-50 hover:border-emerald-200 text-stone-400 hover:text-emerald-700'
                          }`}
                          title={g.completed ? 'Re-open Goal' : 'Mark Completed'}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(g.id)}
                          className="p-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-rose-50 hover:border-rose-200 text-stone-400 hover:text-rose-700 transition cursor-pointer"
                          title="Delete Goal"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3.5 space-y-1.5">
                      <div className="flex justify-between items-baseline text-[10px] font-mono text-stone-500">
                        <span>Progress Hours:</span>
                        <span className="font-bold text-stone-800">
                          {Math.round(g.currentHours * 10) / 10} / {g.targetHours}h ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden border border-stone-200">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            g.completed ? 'bg-emerald-600' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Partner's Goals */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono">
            👥 {partner.name}'s Synchronized Targets ({partnerGoals.length})
          </p>

          <div className="space-y-2">
            {partnerGoals.length === 0 ? (
              <p className="text-xs font-serif italic text-stone-400 py-3 text-center bg-stone-50/40 border-2 border-dashed border-stone-200 rounded-xl">
                {partner.name} hasn't defined any active goals yet.
              </p>
            ) : (
              partnerGoals.map((g) => {
                const percent = getGoalPercent(g);
                return (
                  <div
                    key={g.id}
                    className={`p-3.5 rounded-xl border-2 bg-stone-50/30 transition shadow-xs ${
                      g.completed ? 'border-emerald-200' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase font-mono px-2 py-0.5 rounded border bg-stone-100 text-stone-500 border-stone-200">
                            {g.category}
                          </span>
                          {g.deadline && (
                            <span className="text-[9px] text-stone-400 font-mono flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {new Date(g.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm font-bold text-stone-800 truncate ${g.completed ? 'line-through text-stone-400' : ''}`}>
                          {g.title}
                        </p>
                      </div>

                      {g.completed && (
                        <span className="text-emerald-700 font-bold text-[10px] font-mono flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                          <Award className="h-3.5 w-3.5" /> Nailed!
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3.5 space-y-1.5">
                      <div className="flex justify-between items-baseline text-[10px] font-mono text-stone-500">
                        <span>Progress Hours:</span>
                        <span className="font-bold text-stone-800">
                          {Math.round(g.currentHours * 10) / 10} / {g.targetHours}h ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden border border-stone-200">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            g.completed ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

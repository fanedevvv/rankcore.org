import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Edit2, LogIn, LogOut, Save, X } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewsItem {
  id: string;
  title: string;
  date: string;
  description: string;
}

const Admin = () => {
  const { user, isAdmin, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", date: "", description: "" });
  const [adding, setAdding] = useState(false);

  const fetchNews = async () => {
    const { data } = await supabase
      .from("news")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setNews(data);
  };

  useEffect(() => {
    if (isAdmin) fetchNews();
  }, [isAdmin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error.message);
    setLoginLoading(false);
  };

  const handleAdd = async () => {
    if (!form.title || !form.date || !form.description) {
      toast.error("All fields required");
      return;
    }
    const { error } = await supabase.from("news").insert(form);
    if (error) toast.error(error.message);
    else {
      toast.success("News added!");
      setForm({ title: "", date: "", description: "" });
      setAdding(false);
      fetchNews();
    }
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from("news").update(form).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("News updated!");
      setEditing(null);
      fetchNews();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("news").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("News deleted!");
      fetchNews();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="py-40 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  // Login form
  if (!user) {
    return (
      <Layout>
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-md">
            <h1 className="text-4xl font-display font-extrabold text-center text-noxx-red mb-8">
              Admin Login
            </h1>
            <form onSubmit={handleLogin} className="glass-card p-8 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50"
                  placeholder="admin@yakuza.my"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50"
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-noxx-red text-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {loginLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </section>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="py-40 text-center">
          <p className="text-muted-foreground mb-4">You don't have admin access.</p>
          <button onClick={signOut} className="px-6 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80">
            Sign Out
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-display font-extrabold text-noxx-red">
              Admin Panel
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{user.email}</span>
              <button onClick={signOut} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>

          {/* Add news */}
          <div className="mb-8">
            {!adding ? (
              <button
                onClick={() => { setAdding(true); setForm({ title: "", date: "", description: "" }); }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-noxx-red text-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Add News
              </button>
            ) : (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-3">
                <h3 className="font-display font-bold text-foreground">New Article</h3>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Title"
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50"
                />
                <input
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  placeholder="Date (e.g. January 30, 2026)"
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50"
                />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleAdd} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-noxx-red text-foreground text-sm font-semibold hover:opacity-90">
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button onClick={() => setAdding(false)} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* News list */}
          <div className="space-y-4">
            {news.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No news articles yet.</p>
            )}
            {news.map((item) => (
              <div key={item.id} className="glass-card p-6">
                {editing === item.id ? (
                  <div className="space-y-3">
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50"
                    />
                    <input
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50"
                    />
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-noxx-red/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(item.id)} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-noxx-red text-foreground text-sm font-semibold hover:opacity-90">
                        <Save className="w-4 h-4" /> Save
                      </button>
                      <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80">
                        <X className="w-4 h-4" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display font-bold text-foreground text-lg">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{item.date}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { setEditing(item.id); setForm({ title: item.title, date: item.date, description: item.description }); }}
                        className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive hover:bg-destructive/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Admin;

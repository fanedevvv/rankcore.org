import { useEffect, useState } from "react";

const kanjiChars = ["極", "武", "戦", "影", "鬼", "闘", "光", "龍", "勝", "山", "道", "雷", "拳", "智", "王", "誠", "忠", "侍", "剣", "雲", "死", "義", "勇", "心", "虎", "水", "刀", "力", "魂", "夢", "神"];

interface KanjiItem {
  id: number;
  char: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  rotation: number;
}

const KanjiBackground = () => {
  const [items, setItems] = useState<KanjiItem[]>([]);

  useEffect(() => {
    const generated: KanjiItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      char: kanjiChars[Math.floor(Math.random() * kanjiChars.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 40 + 20,
      opacity: Math.random() * 0.15 + 0.05,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 8,
      rotation: Math.random() * 30 - 15,
    }));
    setItems(generated);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute text-noxx-red animate-float-particle font-bold select-none"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: `${item.size}px`,
            opacity: item.opacity,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
            transform: `rotate(${item.rotation}deg)`,
          }}
        >
          {item.char}
        </div>
      ))}
    </div>
  );
};

export default KanjiBackground;

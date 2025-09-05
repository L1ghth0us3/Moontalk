// Tokenization and normalization helpers for Translator 2.0

export function norm(s: string){ return s.toLowerCase().trim(); }
export function isWordChar(ch: string){ return /[A-Za-z0-9]/.test(ch); }

export type IntakeToken = { text:string; start:number; end:number };

export function tokenize(s: string){
  const out: IntakeToken[] = [];
  let i=0; const n=s.length;
  while(i<n){
    const ch=s[i];
    if (ch==='?'){ out.push({text:'?',start:i,end:i+1}); i++; continue; }
    if (!isWordChar(ch)&&ch!==' '){ i++; continue; }
    if (ch===' '){ i++; continue; }
    const st=i; while(i<n && isWordChar(s[i])) i++; const ed=i;
    const w = s.slice(st,ed).toLowerCase(); if (w==='a'||w==='an'||w==='the') continue; out.push({text:w,start:st,end:ed});
  }
  return out;
}

export function edit1(a:string,b:string){ if(a===b)return true; const la=a.length,lb=b.length; if(Math.abs(la-lb)>1)return false; let i=0,j=0,d=0; while(i<la&&j<lb){ if(a[i]===b[j]){i++;j++;continue;} if(++d>1)return false; if(la>lb)i++; else if(lb>la)j++; else {i++;j++;} } return d+(la-i)+(lb-j)<=1; }
export function splitItems(s:string){ return (s||'').split(/[;,]/).map(x=>norm(x)).filter(Boolean); }

export function stemVerb(w:string){
  if (w.endsWith('ing') && w.length>4) return w.slice(0,-3);
  if (w.endsWith('ed') && w.length>3) return w.slice(0,-2);
  if (w.endsWith('s') && w.length>3 && !w.endsWith('ss')) return w.slice(0,-1);
  return w;
}


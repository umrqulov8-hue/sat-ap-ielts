# helper: write DSL from python tuples
def write(path, items):
    out=[]
    for it in items:
        n,t=it[0],it[1]; o=it[2] if len(it)>2 else None
        out.append(f"## {n}\n{t}"+(f"\n@ {o}" if o else ""))
    open(path,'w').write('\n'.join(out)+'\n'); print(len(items),'written to',path.split('/')[-1])
def eq(e): return f'<p style="text-align:center">${e}$</p>'
def S(*eqs): return '<p style="text-align:center">'+'<br>'.join(f'${e}$' for e in eqs)+'</p>'
def tbl(h,rows,cap=''): return '<table>'+(f'<caption>{cap}</caption>' if cap else '')+'<thead><tr>'+''.join(f'<th>{x}</th>' for x in h)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{c}</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table>'

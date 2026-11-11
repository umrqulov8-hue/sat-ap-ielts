# helper: write DSL from python tuples
def write(path, items):
    out=[]
    for it in items:
        n,t=it[0],it[1]; o=it[2] if len(it)>2 else None
        out.append(f"## {n}\n{t}"+(f"\n@ {o}" if o else ""))
    open(path,'w').write('\n'.join(out)+'\n'); print(len(items),'written to',path.split('/')[-1])
def eq(e): return f'<p style="text-align:center">${e}$</p>'

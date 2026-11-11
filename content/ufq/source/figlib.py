import pymupdf, os
from PIL import Image
def save(name, svg):
    open(f'fig/{name}.svg','w').write(svg)
    doc=pymupdf.open(f'fig/{name}.svg'); pix=doc[0].get_pixmap(dpi=110, alpha=False)
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    im.save(f'fig/{name}.webp','WEBP',quality=82,method=6); im.save(f'fig/{name}.png')
    print(name, im.size, os.path.getsize(f'fig/{name}.webp'))
def grid_plot(W,H,l,t,r,b,xmin,xmax,ymin,ymax,xstep,ystep,xlabel,ylabel,title='',grid=True,yfmt=lambda v:str(v)):
    sx=lambda x:l+(x-xmin)/(xmax-xmin)*(W-l-r); sy=lambda y:H-b-(y-ymin)/(ymax-ymin)*(H-t-b)
    s=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#fff"/>']
    x=xmin
    while x<=xmax+1e-9:
        if grid: s.append(f'<line x1="{sx(x)}" y1="{sy(ymin)}" x2="{sx(x)}" y2="{sy(ymax)}" stroke="#bbb" stroke-width="1"/>')
        s.append(f'<text x="{sx(x)}" y="{H-b+18}" font-size="14" text-anchor="middle" font-family="Times,serif">{x:g}</text>'); x+=xstep
    y=ymin
    while y<=ymax+1e-9:
        if grid: s.append(f'<line x1="{sx(xmin)}" y1="{sy(y)}" x2="{sx(xmax)}" y2="{sy(y)}" stroke="#bbb" stroke-width="1"/>')
        s.append(f'<text x="{l-8}" y="{sy(y)+5}" font-size="14" text-anchor="end" font-family="Times,serif">{yfmt(y)}</text>'); y+=ystep
    s.append(f'<rect x="{sx(xmin)}" y="{sy(ymax)}" width="{sx(xmax)-sx(xmin)}" height="{sy(ymin)-sy(ymax)}" fill="none" stroke="#000" stroke-width="1.5"/>')
    s.append(f'<text x="{(l+W-r)/2}" y="{H-8}" font-size="15" text-anchor="middle" font-style="italic" font-family="Times,serif">{xlabel}</text>')
    s.append(f'<text transform="translate(16,{(t+H-b)/2}) rotate(-90)" font-size="15" text-anchor="middle" font-style="italic" font-family="Times,serif">{ylabel}</text>')
    if title: s.append(f'<text x="{(l+W-r)/2}" y="16" font-size="16" text-anchor="middle" font-weight="bold" font-family="Times,serif">{title}</text>')
    return s,sx,sy

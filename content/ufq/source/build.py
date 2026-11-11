import re, json, sys, pymupdf
SRC='/Users/macbookm3/Movies/UFQ.pdf'
TOPICS=[(1,191,'Ratios, Rates, and Units'),(192,475,'Percentages'),(476,750,'Linear Equations and Word Problems'),(751,994,'Linear Functions and Graphs'),(995,1184,'Systems of Linear Equations'),(1185,1289,'Inequalities'),(1290,1514,'Polynomial Expressions and Equations'),(1515,1567,'Exponents and Radicals'),(1568,1861,'Quadratic Equations and Functions'),(1862,2037,'Exponential Functions and Models'),(2038,2108,'Rational and Radical Equations'),(2109,2287,'Functions, Absolute Value, and Transformations'),(2288,2448,'Data Displays and Statistical Measures'),(2449,2507,'Scatterplots and Models'),(2508,2601,'Probability'),(2602,2627,'Sampling and Statistical Inference'),(2628,2754,'Lines, Angles, and Polygons'),(2755,2824,'Congruence and Similarity'),(2825,3024,'Circles and Coordinate Geometry'),(3025,3251,'Area, Surface Area, and Volume'),(3252,3394,'Right Triangles and Trigonometry')]
def topic_of(n):
    for i,(a,b,name) in enumerate(TOPICS):
        if a<=n<=b: return i+1,a,b,name
def load_answers():
    d=pymupdf.open(SRC); ans={}; pat=re.compile(r'^(\d{1,4})\.\s+(.+)$')
    for p in d:
        t=p.get_text()
        if not re.search(r'Answers\s+-\s+questions',t): continue
        for line in t.split('\n'):
            m=pat.match(line.strip())
            if m: ans[int(m.group(1))]=m.group(2).strip()
    return ans
def parse(path):
    qs=[]; cur=None
    for line in open(path,encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('## '):
            cur={'n':int(line[3:]),'text':[], 'opts':None}; qs.append(cur)
        elif line.startswith('@ ') and cur is not None: cur['opts']=[o.strip() for o in line[2:].split(' | ')]
        elif cur is not None: cur['text'].append(line)
    return qs
def build(path,out):
    ans=load_answers(); qs=parse(path); rows=[]; problems=[]
    for q in qs:
        n=q['n']; key=ans.get(n)
        if key is None: problems.append(f'Q{n}: no answer in key'); continue
        text='\n'.join(q['text']).strip()
        fig=re.findall(r'\[\[fig:(\w+)\]\]',text)
        text=re.sub(r'\[\[fig:\w+\]\]','',text).strip()
        t,a,b,name=topic_of(n); frac=(n-a)/(b-a+1)
        diff='easy' if frac<1/3 else 'medium' if frac<2/3 else 'hard'
        row={'qno':n,'topic':name,'difficulty':diff,'question_text':text}
        if fig: row['image_file']=fig[0]+'.webp'
        if q['opts']:
            if not re.fullmatch(r'[A-D]',key): problems.append(f'Q{n}: has options but key={key!r}'); continue
            row['options']=q['opts']; row['correct']=key
        else:
            if re.fullmatch(r'[A-D]',key): problems.append(f'Q{n}: key letter but no options'); continue
            row['type']='written'; row['correct_answer']=key
        rows.append(row)
    json.dump(rows,open(out,'w'),ensure_ascii=False,indent=1)
    print(len(rows),'rows;',len(problems),'problems'); [print(' ',p) for p in problems]
if __name__=='__main__': build(sys.argv[1],sys.argv[2])

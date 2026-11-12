from mk import *
G='Graph A | Graph B | Graph C | Graph D'
def P(*ps): return ''.join(f'<p>{p}</p>' for p in ps)
def F(n): return f'<p></p>[[fig:v{n}]]'
Q=[]
def add(n,t,o=None): Q.append((n,t,o))
add(434,P("Mount Everest is the highest mountain on the planet. In 1999, the highest point on the mountain was measured to be 29.035 feet above sea level. Scientists believe that Mount Everest is still growing and estimate that the height of the mountain is increasing between 0.16 and 2.4 inches every year.","(Note: 1 foot = 12 inches)","Based on the scientists' estimates, which of the following inequalities represents the height $h$, in feet, of Mount Everest 12 years after 1999?"),
 r"$29.035+0.16\lt h\lt 29.035+2.4$ | $29.035+0.16\gt h\gt 29.035+2.4$ | $29.035+0.16h\lt 29.035+2.4h$ | $29.035+0.16h\gt 29.035+2.4h$")
add(1295,r"Given $n^{\frac{5}{3}}=k^{\frac{2}{5}}$ and $n^{4a+1}=k$, what is the value of $a$?")
add(1423,r"The expression $\frac{x+7}{x^2+2x-35}-\frac{16-x^2}{x+4}$ is equivalent to $\frac{x^2+bx+c}{x-5}$, where $x\gt 5$ and $b$ and $c$ are constants. What is $bc$?")
add(1487,S(r"\sqrt[8]{x^m}")+r"<p>In the given expression, $m$ is a constant and $x\gt 1$. The expression can be rewritten as $\sqrt[5]{x}$. What is the value of $m$?</p>")
add(1497,r"<p>Given the expression</p>"+S(r"\sqrt[4]{40n}\times\left(\sqrt[5]{40n}\right)^3")+r"<p>find the value of $y$ for which the expression is equivalent to $(40n)^{30y}$, where $n\gt 1$.</p>",
 r"$\frac{17}{600}$ | $\frac{10}{600}$ | $\frac{7}{600}$ | $\frac{14}{600}$")
add(1629,S(r"\sqrt[7]{p^4}=t^{\frac{5}{7}}")+r"<p>In the given equation, $p\gt 1$ and $t\gt 1$. If $t=p^{2n-1}$, where $n$ is a constant, what is the value of $n$?</p>")
add(1662,"The $xy$-plane above shows two points of intersection of the graphs of a linear function and a quadratic function. The vertex of the graph of the quadratic function is at $(3,-4)$ and $(r,s)$ is one of the points of intersection of the graphs. What is the value of $r$?"+F(1662))
add(1732,"Which of the following could be the equation of the graph in the $xy$-plane above?"+F(1732),
 r"$y=(x^2+1)(3-x)$ | $y=(x^2+1)(x-3)$ | $y=(x^2+1)(x+3)$ | $y=(x^2-3)(x+1)$")
add(1739,"In the given equations, $a$ and $b$ are constants, $a\\gt 1$ and $b\\gt 1$. What is the value of $x$?"+S(r"\sqrt[7]{a^5}=\sqrt{b^5}",r"a^{3x-3}=b^3"),
 r"$\frac{27}{21}$ | $\frac{21}{27}$ | $\frac{32}{21}$ | $\frac{38}{21}$")
add(1740,r"The graph of $y=6x^2+bx+c$ is shown, where $b$ and $c$ are constants. The graph passes through the points $(-2,-3)$ and $(0,-3)$. What is $bc$?"+F(1740))
add(1741,r"In the $xy$-plane above, the function $f$ is defined by $f(x)=2x^3+3x^2+ax+b$, where $a$ and $b$ are constants. If the graph of $f$ intersects the $x$-axis at three points, what is the value of $a$?"+F(1741))
add(1781,S(r"y=2x^2-19x+40","y=x+a")+r"<p>In the given system of equations, $a$ is a constant. The graphs of the equations in the given system intersect at exactly one point $(x,y)$ in the $xy$-plane. What is the value of $x$?</p>",
 r"$-10$ | $-5$ | $5$ | $10$")
add(1810,r"The graph of $y=g(x)$ is shown. If $g(x+28)=\left(\frac{1}{10}\right)(x-a)^2(x-b)^2(x-c)$, where $a$, $b$, and $c$ are constants, which could be $b$?"+F(1810),
 r"$31$ | $3$ | $-2$ | $-25$")
add(1840,r"An object launched from the top of a building reaches a maximum height of 250 feet above the ground 1.3 seconds after launch. Which graph could represent its height $y$, in feet, $x$ seconds after launch?"+F(1840),G)
add(1844,r"During a physics demonstration, an object was thrown upward and then fell to the ground. The graph shows the height above the ground $y$, in feet, of the object $x$ seconds after it was thrown. To the nearest whole number, what was the total distance, in feet, that the object fell after reaching its highest point above the ground?"+F(1844))
add(1848,r"Which graph represents $y=(x-2)^2$?"+F(1848),G)
add(1852,"The graph of two equations in a system of equations is shown in the $xy$-plane above. Which of the following statements is true?"+F(1852),
 r"The point $(0,0)$ represents the solution to the system. | The points $(-1,-5)$ and $(1,5)$ represent the solutions to the system. | The point $(5,5)$ represents the solution to the system. | The points $(5,0)$ and $(0,5)$ represent the solutions to the system.")
add(1855,r"The graph of $y=f(x)+2$ is shown below. Which equation defines the function $f(x)$?"+F(1855),
 r"$f(x)=-5^x+1$ | $f(x)=-5^x+3$ | $f(x)=-5^x+4$ | $f(x)=-5^x+5$")
add(1856,P(r"The function $g$ is shown in the $xy$-plane above, and the function $f$ (not shown) is defined by $f(x)=x^2+4x+3$. Which of the following statements must be true?",r"I. The minimum value of $f$ is greater than the minimum value of $g$.",r"II. The $y$-intercept of $f$ is less than the $y$-intercept of $g$.",r"III. The functions $f$ and $g$ intercept on the $x$-axis.")+F(1856),
 "I only | II only | III only | I and II only")
add(1860,S(r"v=9.8t+5")+P(r"The equation above models the vertical speed $v$, in meters per second, of a skydiver $t$ seconds after jumping down out of an airplane, where the effect of air resistance has been ignored.",r"Which of the following displays the graph of the vertical speed, in meters per second (m/s), of the skydiver based on the number of seconds after the jump began?")+F(1860),G)
add(1861,r"The shaded region shown represents the solutions to $rx+ty\ge -77$, where $r$ and $t$ are constants. What is the value of $r+t$?"+F(1861),r"$8$ | $6$ | $-6$ | $-7$")
add(1907,r"The function $N(t)=N_0(1.04)^{\frac{2t}{6}}$ models the growth of a number $N$ over $t$ years. If the number $N$ increases by $p$% every 36 months, what is the value of $p$?")
add(1914,r"The graph in the $xy$-plane above shows the linear function $f$. If $g(x)=-2x+4$, in which quadrant does the graph of $y=f(x)$ intersect the graph of $y=g(x)$?"+F(1914),"I | II | III | IV")
add(1918,r"Which of the following could be the graph of $y=\frac{1}{4}(x-2)^3+a$ in the $xy$-plane, where $a$ is a positive constant?"+F(1918),G)
add(1946,r"The function $f$ is defined by $f(x)=x^3$. The function $g$ is defined by $g(x)=a\cdot f(x+b)+c$, where $a$, $b$, and $c$ are constants. The graph of $y=g(x)$ is shown in the $xy$-plane. Find the value of $ab$."+F(1946))
add(1976,r"The equation $N(m)=63(Q)^{\frac{m}{6}}$ gives the predicted population $N(m)$, in thousands, of a certain bacteria colony $m$ minutes after the initial measurement, where $Q$ is a constant greater than 1. The predicted population increases by $p$% every 180 seconds. What is the value of $p$ in terms of $Q$?",
 r"$100\left(Q^{30}-1\right)$ | $100\left(Q^{\frac{1}{2}}-1\right)$ | $100\left(Q^{30}+1\right)$ | $100\left(Q^{\frac{1}{2}}+1\right)$")
add(1979,r"For the function $f$, for each increase in the value of $x$ by 4, the value of $f(x)$ increases by a factor of $m$. Which of the following equivalent forms displays $m$ as a constant or coefficient?",
 r"$f(x)=13(100)^{2x}$ | $f(x)=13(1000)^{\frac{x}{3}}$ | $f(x)=13\left(10^{\frac{6}{5}}\right)^{6x}$ | $f(x)=13\left(100000^{\frac{6}{5}}\right)^{\frac{1}{4}x}$")
add(2011,r"For the function $f$, for each increase in the value of $x$ by $c$, where $c$ is a positive constant, the value of $f(x)$ increases by a factor of 27. Which of the following equivalent forms of the function $f$ displays $\frac{1}{c}$ as a coefficient of $x$?",
 r"$f(x)=48(3)^{\frac{1}{2}x}$ | $f(x)=48\left(3^3\right)^{\frac{1}{6}x}$ | $f(x)=48(9)^{\frac{1}{4}x}$ | $f(x)=48\left(27^{\frac{1}{3}x}\right)^{\frac{1}{2}}$")
add(2164,P("The figure above shows the complete graph of the function $f$ in the $xy$-plane.",r"The function $g$ (not shown) is defined by $g(x)=f(x)+6$. What is the maximum value of the function $g$?")+F(2164))
add(2194,r"The complete graph of the function $f$ is shown in the $xy$-plane above. What is the $y$-intercept of the graph of $y=f(x-2)$?"+F(2194),r"$-1$ | $0$ | $1$ | $2$")
add(2221,r"The graph of $y=f(x)$ is shown in the $xy$-plane. For what value of $x$ does $f(x)=0$?"+F(2221),r"$6$ | $1$ | $0$ | $-6$")
add(2280,S(r"y=2(1.1)^x")+P(r"The equation above models the number of miles, $y$, that Jenna plans to run on week $x$ of an 8-week training regimen. Which of the following graphs models this situation?")+F(2280),G)
add(2284,r"Eight different metals are heated to 373 kelvins (K). The electrical conductivity of each metal (horizontal axis) is measured in $\frac{1}{\text{ohm}\times\text{cm}}$, and the thermal conductivity of each metal (vertical axis) is measured in $\frac{\text{watt}}{\text{cm}\times\text{K}}$. The data for each metal are recorded in the scatterplot above. Based on the scatterplot, which of the following best predicts the thermal conductivity, in $\frac{\text{watt}}{\text{cm}\times\text{K}}$, for a metal whose electrical conductivity is $2.8\times10^{5}\ \frac{1}{\text{ohm}\times\text{cm}}$?"+F(2284),
 "1 | 2.5 | 3.5 | 4.5")
add(2342,tbl(['Country','2012','2013'],[['France','83.0','84.7'],['United States','66.7','69.8'],['Spain','57.5','60.7'],['China','57.5','55.7'],['Italy','46.4','47.7'],['Turkey','35.7','37.8'],['Germany','30.4','31.5'],['United Kingdom','26.3','32.2'],['Russia','24.7','28.4']],'International Tourist Arrivals, in millions')+P("The table above shows the number of international tourist arrivals, rounded to the nearest tenth of a million, to the top nine tourist destinations in both 2012 and 2013.","Based on the information given in the table, how much greater, in millions, was the median number of international tourist arrivals to the top nine tourist destinations in 2013 than the median number in 2012, to the nearest tenth of a million?"))
add(2380,P("Two data sets each containing 20 integers are summarized in histograms. For the histogram, the first interval represents the frequency of integers greater than or equal to 40, but less than 50. The second interval represents the frequency of integers greater than or equal to 30, but less than 40, and so on. The mean of Data Set A is equal to $a$. The mean of Data Set B is equal to $b$. What is the smallest possible value of $\\frac{b}{a}$?")+F(2380).replace('<p></p>',''))
add(2395,P("Data set A records the number of pieces of mail received each day for 11 days, as shown. The value 14 is removed to form data set B. How does the median of B compare with that of A?")[:-0 or None]+tbl(['Pieces of mail','Frequency'],[['0','2'],['3','2'],['4','2'],['5','2'],['6','1'],['7','1'],['14','1']]),
 "The median of B is greater. | The medians are equal. | The median of B is less. | There is not enough information.")
add(2419,tbl(['Sample','1','2','3','4','5','6','7'],[['Lead (ppm)','1523','847','1267','692','1401','1088','?']],'Lead Samples on a Farm')+P("To determine whether to buy a plot of land, a farmer is having the soil tested for lead. The table above shows the amount of lead, in parts per million (ppm), in six of the seven samples of soil selected at random. If the average (arithmetic mean) amount of lead in the seven samples, in ppm, is no more than 1200, the farmer will buy the plot of land; otherwise, the farmer will not buy it. What is the greatest possible amount of lead, in ppm, that can be in the seventh sample if the farmer buys the land?"))
def ftab(L,rows): return tbl(['Number of eggs','Frequency'],rows,L)
add(2438,P("A zoologist observed the nests of wood ducks in an area. Each year, the zoologist recorded the number of eggs in each of the first 50 nests that were observed and created a frequency table for the data set. Which of the following frequency tables represents the data set with the smallest standard deviation?")+ftab('A)',[[12,11],[13,10],[14,8],[15,10],[16,11]])+ftab('B)',[[12,10],[13,10],[14,10],[15,10],[16,10]])+ftab('C)',[[12,2],[13,11],[14,24],[15,11],[16,2]])+ftab('D)',[[12,0],[13,5],[14,40],[15,5],[16,0]]),
 "Table A | Table B | Table C | Table D")
add(2471,r"The scatterplot shows the relationship between variables $x$ and $y$ for data set P. A line of best fit for the data is also shown (approximately $y=0.02x+12.2$). Data set Q is created by adding 649 to each $x$-value. Which could be an equation of a line of best fit for data set Q?"+F(2471),
 r"$y=28+\frac{35}{1{,}301}x$ | $y=18+\frac{1}{131}x$ | $y=9+\frac{1}{131}x$ | $y=-6+\frac{35}{1{,}301}x$")
add(2668,P(r"For triangles $PQR$ and $KLM$, the angles $Q$ and $L$ are equivalent and $PR=\frac{3}{4}KM$. Which of the following information is enough to claim that $PQR$ and $KLM$ are similar?",r"I. The length of $PQ$ is $\frac{3}{4}$ of the length of $KL$.",r"II. The length of $LM$ is $\frac{3}{4}$ of the length of $QR$."),
 "Only I | I and II | Only II | Neither I nor II")
add(2669,r"Lines $r$ and $s$ are parallel and transversal $t$ intersects both. If $y=\frac{pw}{132}-w$, what is $p$?"+F(2669),"264 | 132 | 66 | Not enough information")
add(2670,P("Note: Figure not drawn to scale.",r"In the figure above, lines $\ell$ and $m$ are parallel, $y=20$, and $z=60$. What is the value of $x$?")+F(2670),"120 | 100 | 90 | 80")
add(2676,P(r"In the figure, $AB$, $DE$, and $CF$ are parallel, and $205\lt x+y+z\lt212$. Which could equal $w-y$?","I. 26","II. 32")+F(2676),"I only | II only | I and II | Not enough information")
add(2723,r"In quadrilateral $KLMN$, $KL=3$, $LM=3$, $KN=27$, and $MN=27$. Diagonals intersect at point $G$, where $GK=1$ and $GM=1$. If the length of diagonal $LN$ is $\sqrt{p}+\sqrt{w}$, what is $p+w$?")
add(2740,P(r"In the figure, $AG$ is parallel to $DE$, point $B$ lies on $AG$, and $AE$ intersects $DB$ at point $C$. If $y=2x-35$ and $z=136$, what is the value of $x$?","Note: Figure not drawn to scale.")+F(2740))
add(2745,P("Note: Figure not drawn to scale.",r"In the figure above, lines $a$, $b$, and $c$ are parallel. If $201\lt x+y+z\lt212$, which of the following could be true?",r"I. $w-y=22$",r"II. $w-y=32$")+F(2745),"I only | II only | I and II | Neither I nor II")
add(2777,r"Triangle $QRS$ is similar to triangle $FGH$, with $Q$, $R$, and $S$ corresponding to $F$, $G$, and $H$. Each side of $FGH$ is $\frac{1}{3}$ the length of its corresponding side in $QRS$. Angle $F$ is $35^\circ$, angle $G$ is $6^\circ$, and $FG=a$. Angle $Q$ is $b^\circ$, and $QR=30$. What is $a+b$?")
add(2926,r"Points $X$, $Y$, and $Z$ all lie on Circle $O$. The measure of angle $XYZ$ is 152.6 degrees. What is the sum of the measures of arcs $XY$ and $YZ$?")
add(3152,r"The figure above shows that the triangular region (dashed) with a hypotenuse of 5 centimeters (cm) has been removed from a rectangular tile with dimensions $x$ cm by $y$ cm. Of the following, which best approximates the area, in square centimeters, of the tile <u>before</u> the piece was removed?"+F(3152),"15 | 43 | 50 | 65")
add(3187,"What is the area, in square units, of the triangle formed by connecting the three points shown?"+F(3187))
add(3199,"Find the area of the triangle that is formed by connecting the 3 points shown below."+F(3199))
add(3275,r"In the figure above, $RT=TU$. What is the value of $x$?"+F(3275),"72 | 66 | 64 | 58")
add(3290,r"In the figure above, the sides of a triangle are extended as shown. What is the value of $x$?"+F(3290),"80 | 70 | 60 | 40")
add(3304,P("Note: Figure not drawn to scale.",r"In the figure above, $\angle B$ is congruent to $\angle E$. What is the value of $\sin D$?")+F(3304),r"$\frac{3}{5}$ | $\frac{4}{5}$ | $\frac{16}{5}$ | $\frac{16}{25}$")
add(3326,P("Figure not drawn to scale.",r"In the figure, $BC$ is parallel to $DE$. If the length of $DE$ is 129 and the length of $AE$ is 215, what is the value of $\tan x^\circ$?")+F(3326),r"$\frac{129}{172}$ | $\frac{129}{215}$ | $\frac{172}{129}$ | $\frac{215}{129}$")
add(3350,r"In the $xy$-plane above, what is the value of $a$?"+F(3350),"6 | 4.5 | 4 | 3")
add(3354,P(r"In the figure above (not drawn to scale), segment $AC$ bisects $\angle BAD$, and $\angle B$ is a right angle.",r"If $BC=4$ and $AD=10$, what is the area of triangle $ACD$?")+F(3354))
add(3377,P("Note: Figure not drawn to scale.",r"In the figure, $\angle ABD=w^\circ$, $\angle CAD=z^\circ$, and $\cos w=\frac{9}{41}$. What is the value of $\tan z$?")+F(3377))
add(3378,r"In the figure above, $CD=5$ and $AD=8$. What is the value of the cosine of $\angle AEB$?"+F(3378),r"$\frac{5}{\sqrt{89}}$ | $\frac{8}{\sqrt{89}}$ | $\frac{5}{8}$ | $\frac{8}{5}$")
add(3379,P("Note: figure not drawn to scale.","The figure above represents the relative positions of the Sun, Earth, and Mars at a particular time when the distance from the Sun to Mars is approximately 220,000,000 kilometers and the distance from the Sun to Earth is approximately 149,000,000 kilometers. What is the approximate distance, in kilometers, from Earth to Mars at that time?")+F(3379),"27,000,000 | 71,000,000 | 162,000,000 | 266,000,000")
add(3386,r"The tangent of angle $C$ in the picture below is equal to $\frac{252}{275}$ and $EF$ is parallel to $BC$. What is the value of $\sin E$?"+F(3386),r"$\frac{252}{373}$ | $\frac{373}{252}$ | $\frac{275}{252}$ | $\frac{275}{373}$")
add(3393,r"The hypotenuse of a right triangle is shown below. The area of the triangle is $4\sqrt{21}$. Which of the following is the length of one leg of the triangle?"+F(3393),r"10 | $\sqrt{21}$ | $2\sqrt{21}$ | $4\sqrt{21}$")
# collapse any newlines
Q=[(n,t.replace('\n',' '),o) for n,t,o in Q]
write('w2.txt',Q)

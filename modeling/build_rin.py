"""Reproducible modular Rin academy first-pass model. Run with Blender --background --python."""
import bpy, math, json, os
from mathutils import Vector
from pathlib import Path
from math import sin, cos, pi, sqrt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'rin'
PRE = ROOT / 'previews'
OUT.mkdir(parents=True, exist_ok=True)
PRE.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    if col.name != 'Collection': bpy.data.collections.remove(col)
COLS = {}
for name in ['01_BODY','02_FACE','03_HAIR','04_ACCESSORIES','10_ACADEMY','90_STAGE']:
    c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); COLS[name]=c
PARTS=[]

def mat(name, color, rough=.8, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Specular IOR Level'].default_value=.22
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1); bs.inputs['Emission Strength'].default_value=emission
    return m
SKIN=mat('Skin | peach porcelain',(.94,.66,.56))
HAIR=mat('Hair | dusty rose',(.43,.115,.16),.72)
HAIRLIGHT=mat('Hair | soft rose planes',(.51,.15,.20),.72)
HAIRDARK=mat('Hair | strand edge',(.265,.056,.084))
WHITE=mat('Ivory cotton',(.91,.88,.80))
NAVY=mat('Academy | midnight navy',(.052,.069,.115))
EDGE=mat('Academy | seam',(.085,.107,.16))
SKIRT=mat('Academy | slate pleats',(.18,.215,.29))
TIGHTS=mat('Academy | opaque charcoal',(.065,.065,.079))
SHOE=mat('Academy | brown leather',(.073,.043,.035),.48)
SOLE=mat('Shoe | outsole',(.034,.026,.025))
RIBBON=mat('Ribbon | muted burgundy',(.33,.09,.12))
LASH=mat('Face | warm ink',(.062,.015,.025))
EYEWHITE=mat('Eye | warm white',(.99,.94,.9),.8,.25)
IRIS=mat('Eye | burgundy',(.29,.045,.075),.58,.2)
IRISLOW=mat('Eye | rose amber',(.57,.20,.20),.65,.2)
PUPIL=mat('Eye | pupil',(.064,.01,.025),.8,.12)
GLINT=mat('Eye | catchlight',(1,1,.98),.5,.8)
MOUTH=mat('Face | mouth line',(.30,.07,.08))
BASE=mat('Body | base coverage',(.76,.58,.57))

def register(o,name,material,col,bone=None,weights=None):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    COLS[col].objects.link(o)
    if material: o.data.materials.append(material)
    if o.type=='MESH':
        for p in o.data.polygons: p.use_smooth=True
    if col!='90_STAGE': PARTS.append((o,bone,weights))
    o['module']=col
    return o

def mesh(name,verts,faces,material,col,bone=None,weights=None,sub=0):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    register(o,name,material,col,bone,weights)
    if sub:
        mod=o.modifiers.new('Surface refinement','SUBSURF'); mod.levels=sub
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def uv(name,loc,scale,material,col,bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc)
    o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return register(o,name,material,col,bone)

def curve(name,pts,radius,material,col,bone=None):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=12
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for b,p in zip(sp.bezier_points,pts): b.co=p; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    cu.bevel_depth=radius; cu.bevel_resolution=3
    o=bpy.data.objects.new(name,cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object; o.select_set(False)
    return register(o,name,material,col,bone)

def rings(name,levels,material,col,bone=None,weights=None,n=48,pleat=0,open_front=0):
    vs=[]; fs=[]
    for z,rx,ry,cy in levels:
        for j in range(n+1):
            a=open_front+(2*pi-2*open_front)*j/n
            r=1+pleat*cos(20*a)
            vs.append((rx*sin(a)*r,cy-ry*cos(a)*r,z))
    for k in range(len(levels)-1):
        for j in range(n):
            a=k*(n+1)+j; fs.append((a,a+1,a+n+2,a+n+1))
    return mesh(name,vs,fs,material,col,bone,weights)

def tube(name,points,radii,material,col,bone=None,weights=None,n=20):
    vs=[];fs=[]
    for i,p in enumerate(points):
        p=Vector(p); tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize(); u=tangent.cross(Vector((0,1,0))).normalized(); v=tangent.cross(u).normalized()
        rr=radii[i]; rx,ry=(rr,rr) if isinstance(rr,(float,int)) else rr
        for j in range(n):
            a=j*2*pi/n; vs.append(p+rx*cos(a)*u+ry*sin(a)*v)
    for i in range(len(points)-1):
        for j in range(n):
            a=i*n+j; b=i*n+(j+1)%n; fs.append((a,b,b+n,a+n))
    fs.append(tuple(reversed(range(n)))); fs.append(tuple((len(points)-1)*n+j for j in range(n)))
    return mesh(name,vs,fs,material,col,bone,weights)

# One editable humanoid skeleton shared by base and clothing meshes.
bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
rig=bpy.context.object; rig.name='RIN_RIG'; arm=rig.data; arm.name='RinHumanoid_v01'
arm.edit_bones.remove(arm.edit_bones[0])
BONES={}
def bone(name,head,tail,parent=None):
    b=arm.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm.edit_bones[parent]
    BONES[name]=(Vector(head),Vector(tail))
bone('root',(0,0,.02),(0,0,.15))
bone('hips',(0,0,.82),(0,0,.94),'root')
bone('spine',(0,0,.94),(0,0,1.07),'hips')
bone('chest',(0,0,1.07),(0,0,1.20),'spine')
bone('neck',(0,0,1.20),(0,0,1.32),'chest')
bone('head',(0,0,1.32),(0,0,1.59),'neck')
for side,s in [('L',1),('R',-1)]:
    bone('shoulder.'+side,(0,0,1.18),(s*.16,0,1.18),'chest')
    bone('upper_arm.'+side,(s*.16,0,1.18),(s*.275,0,1.005),'shoulder.'+side)
    bone('forearm.'+side,(s*.275,0,1.005),(s*.365,-.012,.83),'upper_arm.'+side)
    bone('hand.'+side,(s*.365,-.012,.83),(s*.40,-.015,.75),'forearm.'+side)
    for k in range(4):
        x=s*(.386+(k-1.5)*.015)
        bone(f'finger{k+1}.{side}',(x,-.025,.76),(x+s*.018,-.025,.715), 'hand.'+side)
    bone('thumb.'+side,(s*.37,-.02,.78),(s*.348,-.032,.745),'hand.'+side)
    bone('thigh.'+side,(s*.078,0,.855),(s*.082,-.012,.47),'hips')
    bone('shin.'+side,(s*.082,-.012,.47),(s*.084,0,.12),'thigh.'+side)
    bone('foot.'+side,(s*.084,0,.12),(s*.084,-.12,.06),'shin.'+side)
    bone('hair.'+side,(s*.10,.08,1.47),(s*.15,.105,1.17),'head')
    bone('hair_tip.'+side,(s*.15,.105,1.17),(s*.13,.10,.98),'hair.'+side)
bone('skirt.front',(0,-.075,.94),(0,-.145,.65),'hips')
bone('skirt.back',(0,.075,.94),(0,.145,.65),'hips')
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
rig['description']='Shared modular rig; first-pass weights, manual FK. No production IK or cloth simulation yet.'

def torso_weights(v):
    z=v.z
    if z<.94:return {'hips':1}
    if z<1.07:
        t=(z-.94)/.13;return {'spine':1-t,'chest':t}
    return {'chest':1}
def limb_weights(side,upper,lower,joint):
    def calc(v):
        t=max(0,min(1,(v.z-joint+.045)/.09))
        return {upper+'.'+side:t,lower+'.'+side:1-t}
    return calc

body_levels=[(.79,.085,.056,0),(.85,.123,.073,0),(.92,.108,.061,0),(1.00,.098,.060,0),(1.09,.13,.073,-.004),(1.15,.151,.062,0),(1.20,.143,.048,0),(1.235,.052,.042,0)]
rings('Body_Torso',body_levels,SKIN,'01_BODY',weights=torso_weights)
tube('Body_Neck',[(0,0,1.21),(0,0,1.28),(0,0,1.34)],[.041,.035,.044],SKIN,'01_BODY','neck')
rings('BaseCoverage_Torso',[(z,rx*1.018,ry*1.025,cy) for z,rx,ry,cy in body_levels if z>=.85],BASE,'01_BODY',weights=torso_weights)
for side,s in [('L',1),('R',-1)]:
    armpts=[(s*.142,0,1.185),(s*.175,0,1.16),(s*.23,0,1.075),(s*.275,0,1.005),(s*.32,-.005,.925),(s*.365,-.012,.83)]
    tube('Body_Arm_'+side,armpts,[.045,.045,.038,.033,.031,.022],SKIN,'01_BODY',weights=limb_weights(side,'upper_arm','forearm',1.005))
    uv('Body_Palm_'+side,(s*.382,-.013,.79),(.029,.018,.049),SKIN,'01_BODY','hand.'+side)
    for k in range(4):
        x=s*(.386+(k-1.5)*.015); length=[.034,.047,.044,.032][k]
        tube(f'Body_Finger{k+1}_{side}',[(x,-.025,.763),(x+s*.009,-.028,.74),(x+s*.015,-.026,.763-length-.015)],[.0075,.0065,.0035],SKIN,'01_BODY',f'finger{k+1}.{side}',n=12)
    tube('Body_Thumb_'+side,[(s*.365,-.021,.80),(s*.345,-.03,.775),(s*.348,-.032,.748)],[.01,.009,.005],SKIN,'01_BODY','thumb.'+side,n=12)
    legpts=[(s*.076,0,.84),(s*.084,0,.75),(s*.085,-.008,.60),(s*.082,-.012,.47),(s*.084,.003,.36),(s*.084,.005,.22),(s*.084,0,.085)]
    lr=[(.063,.061),(.064,.064),(.048,.047),(.034,.033),(.045,.043),(.029,.029),(.021,.025)]
    tube('Body_Leg_'+side,legpts,lr,SKIN,'01_BODY',weights=limb_weights(side,'thigh','shin',.47))
    tube('BaseCoverage_Shorts_'+side,[(s*.076,0,.86),(s*.084,0,.78),(s*.084,0,.74)],[.067,.068,.067],BASE,'01_BODY','thigh.'+side)
    uv('Body_Foot_'+side,(s*.084,-.054,.065),(.037,.09,.035),SKIN,'01_BODY','foot.'+side)

# Sculpted ring head: rounded cheeks, reduced chin, smooth back volume.
HEAD=[(1.286,.009,.016,-.024),(1.300,.043,.039,-.015),(1.320,.075,.057,-.005),(1.350,.106,.075,0),(1.390,.128,.092,0),(1.440,.136,.105,0),(1.490,.135,.111,.005),(1.540,.127,.106,.010),(1.580,.101,.088,.013),(1.610,.056,.055,.013),(1.622,.003,.003,.013)]
head=rings('Face_Head',HEAD,SKIN,'02_FACE','head',n=80)
mod=head.modifiers.new('Smooth facial topology','SUBSURF');mod.levels=2
bpy.context.view_layer.objects.active=head;bpy.ops.object.modifier_apply(modifier=mod.name)
def face_y(x,z):
    for i in range(len(HEAD)-1):
        a,b=HEAD[i],HEAD[i+1]
        if a[0]<=z<=b[0]:
            t=(z-a[0])/(b[0]-a[0]); rx=a[1]*(1-t)+b[1]*t;ry=a[2]*(1-t)+b[2]*t;cy=a[3]*(1-t)+b[3]*t
            return cy-ry*sqrt(max(.04,1-(x/rx)**2))
    return -.08
def patch(name,cx,cz,rx,rz,material,depth=.003):
    vs=[(cx,face_y(cx,cz)-depth,cz)];fs=[];N=48;R=8
    for k in range(1,R+1):
        for j in range(N):
            a=2*pi*j/N;x=cx+rx*cos(a)*k/R;z=cz+rz*sin(a)*k/R
            vs.append((x,face_y(x,z)-depth,z))
    for j in range(N):fs.append((0,j+1,(j+1)%N+1))
    for k in range(R-1):
        for j in range(N):
            a=1+k*N+j;b=1+k*N+(j+1)%N;fs.append((a,b,b+N,a+N))
    return mesh(name,vs,fs,material,'02_FACE','head')
for side,s in [('L',1),('R',-1)]:
    cx=s*.061;cz=1.439
    patch('EyeWhite_'+side,cx,cz,.038,.039,EYEWHITE,.003)
    patch('IrisRim_'+side,cx,cz-.001,.025,.035,LASH,.004)
    patch('Iris_'+side,cx,cz-.002,.0235,.032,IRIS,.005)
    patch('IrisLower_'+side,cx,cz-.016,.018,.016,IRISLOW,.006)
    patch('Pupil_'+side,cx,cz+.004,.012,.023,PUPIL,.007)
    patch('EyeLight_'+side,cx-.009,cz+.020,.007,.009,GLINT,.008)
    patch('EyeLightSmall_'+side,cx+.010,cz-.018,.003,.004,GLINT,.008)
    pts=[]
    for j in range(13):
        a=pi*j/12;x=cx+.039*cos(a);z=cz+.039*sin(a);pts.append((x,face_y(x,z)-.006,z))
    curve('UpperLid_'+side,pts,.0038,LASH,'02_FACE','head')
    outer=cx+s*.037;z=cz+.012
    curve('LashFlick_'+side,[(outer,face_y(outer,z)-.008,z),(outer+s*.008,face_y(outer,z)-.006,z+.010)],.0026,LASH,'02_FACE','head')
    pts=[(cx+x,face_y(cx+x,1.503)-.005,1.501+.006*(1-abs(x)/.032)) for x in [-.032,-.016,0,.016,.032]]
    curve('Eyebrow_'+side,pts,.0023,HAIRDARK,'02_FACE','head')
    uv('Ear_'+side,(s*.132,.004,1.422),(.021,.014,.035),SKIN,'02_FACE','head')
    uv('EarStud_'+side,(s*.143,-.005,1.399),(.004,.004,.004),WHITE,'04_ACCESSORIES','head')
uv('Nose',(0,-.095,1.388),(.007,.006,.010),SKIN,'02_FACE','head')
curve('Mouth_Line',[(-.014,face_y(-.014,1.352)-.002,1.352),(0,face_y(0,1.351)-.003,1.351),(.014,face_y(.014,1.352)-.002,1.352)],.0015,MOUTH,'02_FACE','head')

# Closed scalp dome and individually shaped ribbon-like volumetric hair locks.
vs=[];fs=[];N=80;ROWS=22
for k in range(ROWS+1):
    t=k/ROWS
    for j in range(N):
        a=2*pi*j/N;front=(1+cos(a))/2; limit=2.05-.86*(front**3)
        ph=.015+t*limit
        vs.append((.144*sin(ph)*sin(a),.014-.121*sin(ph)*cos(a),1.478+.156*cos(ph)))
for k in range(ROWS):
    for j in range(N):a=k*N+j;b=k*N+(j+1)%N;fs.append((a,b,b+N,a+N))
mesh('Hair_Scalp',vs,fs,HAIR,'03_HAIR','head')
def lock(name,centers,widths,depth,material=HAIR,bone_name='head',weightfn=None):
    # Ring sections keep each lock truly three dimensional and closed.
    vs=[];fs=[];N=12
    for i,(p,w) in enumerate(zip(centers,widths)):
        for j in range(N):
            a=2*pi*j/N;vs.append((p[0]+w*cos(a),p[1]+depth*sin(a)*(max(.15,w/max(widths))),p[2]))
    for k in range(len(centers)-1):
        for j in range(N):a=k*N+j;b=k*N+(j+1)%N;fs.append((a,b,b+N,a+N))
    fs.append(tuple(reversed(range(N))));fs.append(tuple((len(centers)-1)*N+j for j in range(N)))
    return mesh(name,vs,fs,material,'03_HAIR',bone_name,weightfn,sub=2)
for idx,(x,end,shift,w) in enumerate([(-.102,1.482,.011,.027),(-.064,1.493,.012,.030),(-.022,1.496,.021,.033),(.018,1.482,.023,.032),(.057,1.468,.023,.029),(.097,1.487,.011,.023)]):
    lock('Hair_Bang_%02d'%idx,[(x*.32,-.025,1.622),(x*.77,-.089,1.590),(x,-.122,1.538),(x+shift,-.124,end+.014),(x+shift+.004,-.12,end)],[w*.25,w*.95,w*1.15,w*.65,.001],.005,HAIRLIGHT if idx%3==0 else HAIR)
for side,s in [('L',1),('R',-1)]:
    def hw(v,s=side):
        t=max(0,min(1,(1.42-v.z)/.25));return {'head':1-t,'hair.'+s:t}
    lock('Hair_FrontLock_'+side,[(s*.119,-.067,1.55),(s*.133,-.090,1.44),(s*.14,-.089,1.28),(s*.153,-.09,1.15),(s*.136,-.085,1.08)],[.014,.018,.019,.019,.001],.013,HAIR,bone_name=None,weightfn=hw)
    for i in range(5):
        x=s*(.029+i*.027);y=.09+.024*sin(i*pi/4)
        lock(f'Hair_Back_{side}_{i}',[(x*.75,.069,1.56),(x,y,1.42),(x*1.12,y+.025,1.25),(x*1.27,y+.025,1.08),(x*1.15,y+.003,1.015+abs(i-2)*.008)],[.021,.034,.037,.039,.002],.022,HAIRLIGHT if i==3 else HAIR,bone_name=None,weightfn=hw)
    curve('Hair_SideSweep_'+side,[(s*.08,-.052,1.59),(s*.14,-.012,1.54),(s*.139,.063,1.485)],.009,HAIRLIGHT,'03_HAIR','head')

def bow_loop(name,s,origin,scale,material,col,bone_name):
    ox,oy,oz=origin
    pts=[(ox,oy,oz),(ox+s*.055*scale,oy-.010*scale,oz+.037*scale),(ox+s*.075*scale,oy+.010*scale,oz+.024*scale),(ox+s*.066*scale,oy+.016*scale,oz-.023*scale),(ox+s*.025*scale,oy+.012*scale,oz-.010*scale)]
    vs=pts+[(x,y+.007*scale,z) for x,y,z in pts];faces=[(0,1,2,3,4),(9,8,7,6,5)]
    faces += [(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
    return mesh(name,vs,faces,material,col,bone_name,sub=1)
for s in [-1,1]:
    bow_loop('WhiteBow_Loop_'+str(s),s,(0,.144,1.49),1,WHITE,'04_ACCESSORIES','head')
    mesh('WhiteBow_Tail_'+str(s),[(s*.008,.148,1.49),(s*.041,.148,1.475),(s*.063,.16,1.365),(s*.036,.158,1.38),(s*.018,.158,1.367)],[(0,1,2,3,4)],WHITE,'04_ACCESSORIES','head')
uv('WhiteBow_Knot',(0,.145,1.485),(.013,.014,.018),WHITE,'04_ACCESSORIES','head')

# Academy modules; no garment is joined to the body mesh.
shirt=rings('Academy_Shirt',[(z,rx*1.045,ry*1.09,cy-.002) for z,rx,ry,cy in body_levels if z>=.92],WHITE,'10_ACADEMY',weights=torso_weights)
jacket=rings('Academy_Jacket',[(.924,.128,.082,0),(.94,.126,.081,0),(1.00,.114,.079,0),(1.09,.150,.092,-.004),(1.15,.173,.081,0),(1.20,.166,.066,0),(1.235,.058,.054,0)],NAVY,'10_ACADEMY',weights=torso_weights,open_front=.30)
for side,s in [('L',1),('R',-1)]:
    sleevepts=[(s*.143,0,1.185),(s*.18,0,1.16),(s*.234,0,1.075),(s*.275,0,1.005),(s*.322,-.005,.921),(s*.36,-.011,.844)]
    tube('Academy_ShirtSleeve_'+side,sleevepts,[.050,.049,.043,.038,.035,.026],WHITE,'10_ACADEMY',weights=limb_weights(side,'upper_arm','forearm',1.005))
    tube('Academy_Sleeve_'+side,sleevepts,[.053,.052,.046,.041,.038,.029],NAVY,'10_ACADEMY',weights=limb_weights(side,'upper_arm','forearm',1.005))
    tube('Academy_Cuff_'+side,[(s*.359,-.011,.85),(s*.367,-.012,.827)],[.029,.027],WHITE,'10_ACADEMY','forearm.'+side)
    mesh('Academy_Collar_'+side,[(s*.006,-.051,1.222),(s*.047,-.045,1.227),(s*.073,-.069,1.192),(s*.055,-.082,1.174),(s*.019,-.079,1.184)],[(0,1,2,3,4)],WHITE,'10_ACADEMY','chest',sub=1)
    bow_loop('Academy_NeckRibbon_'+side,s,(0,-.084,1.184),.40,RIBBON,'10_ACADEMY','chest')
    curve('Academy_RibbonTail_'+side,[(s*.005,-.085,1.18),(s*.013,-.088,1.145),(s*.021,-.088,1.124)],.0045,RIBBON,'10_ACADEMY','chest')
    curve('Academy_JacketPiping_'+side,[(s*.036,-.078,.928),(s*.032,-.074,1.00),(s*.043,-.084,1.10),(s*.047,-.067,1.176)],.0015,EDGE,'10_ACADEMY','chest')
    lp=[(s*.078,0,.86),(s*.084,0,.75),(s*.085,-.008,.60),(s*.082,-.012,.47),(s*.084,.003,.36),(s*.084,.005,.22),(s*.084,0,.105)]
    lr=[(.065,.063),(.066,.066),(.050,.049),(.036,.035),(.047,.045),(.031,.031),(.023,.028)]
    tube('Academy_Tights_'+side,lp,lr,TIGHTS,'10_ACADEMY',weights=limb_weights(side,'thigh','shin',.47))
    uv('Academy_Loafer_'+side,(s*.084,-.052,.066),(.045,.108,.047),SHOE,'10_ACADEMY','foot.'+side)
    uv('Academy_Sole_'+side,(s*.084,-.055,.031),(.046,.111,.018),SOLE,'10_ACADEMY','foot.'+side)
    curve('Academy_PennyStrap_'+side,[(s*.084-.037,-.070,.091),(s*.084,-.074,.109),(s*.084+.037,-.070,.091)],.008,SHOE,'10_ACADEMY','foot.'+side)
for z in [1.16,1.115,1.07,1.025]:
    uv('Academy_ShirtButton',(0,-.082,z),(.0035,.0025,.0035),WHITE,'10_ACADEMY','chest')
def skirt_weights(v):
    t=max(0,min(.7,(.91-v.z)/.36));return {'hips':1-t, 'skirt.front' if v.y<0 else 'skirt.back':t}
rings('Academy_Skirt',[(.94,.126,.078,0),(.929,.132,.084,0),(.86,.16,.108,0),(.73,.209,.14,0),(.64,.237,.158,0),(.633,.238,.159,0)],SKIRT,'10_ACADEMY',weights=skirt_weights,n=160,pleat=.045)
rings('Academy_Waistband',[(.947,.129,.082,0),(.925,.134,.087,0)],SKIRT,'10_ACADEMY','hips')

# Bind every independent piece to the same armature, preserving modular object names.
for o,bn,wfn in PARTS:
    if o.type!='MESH':continue
    # Evaluate weighting in world coordinates, before armature parenting.
    matrix=o.matrix_world.copy()
    if bn:
        vg=o.vertex_groups.new(name=bn);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
    elif wfn:
        groups={}
        for v in o.data.vertices:
            for key,value in wfn(matrix@v.co).items():
                if value>1e-6:
                    if key not in groups:groups[key]=o.vertex_groups.new(name=key)
                    groups[key].add([v.index],value,'REPLACE')
    else:raise RuntimeError('Unbound mesh '+o.name)
    mod=o.modifiers.new('Shared RIN_RIG','ARMATURE');mod.object=rig
    o.parent=rig;o.matrix_world=matrix
    o['outfit']='academy' if o['module']=='10_ACADEMY' else 'base'

# Simple expression keys on visible facial components. Exported as glTF morph targets.
for side in ['L','R']:
    for prefix in ['EyeWhite_','IrisRim_','Iris_','IrisLower_','Pupil_','EyeLight_','EyeLightSmall_','UpperLid_','LashFlick_']:
        o=bpy.data.objects.get(prefix+side)
        o.shape_key_add(name='Basis'); k=o.shape_key_add(name='Blink_'+side); k.value=0
        for v in k.data:
            z=1.439+(v.co.z-1.439)*.035;v.co.z=z
            v.co.y=face_y(v.co.x,z)-(.013 if prefix=='UpperLid_' else .010)
o=bpy.data.objects['Mouth_Line'];o.shape_key_add(name='Basis');k=o.shape_key_add(name='Talk');k.value=0
for v in k.data:v.co.z=1.351+(v.co.z-1.351)*5

# Short FK motion study, useful for checking shared garment binding.
scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=96
for frame,angle in [(1,0),(24,.10),(48,0),(72,-.10),(96,0)]:
    scene.frame_set(frame)
    for name,factor in [('head',1),('chest',.18),('hair.L',-.24),('hair.R',-.24)]:
        p=rig.pose.bones[name];p.rotation_mode='XYZ';p.rotation_euler[1]=angle*factor;p.keyframe_insert('rotation_euler',frame=frame)
if rig.animation_data and rig.animation_data.action:rig.animation_data.action.name='Idle_Look'
scene.frame_set(1)

# Studio scene and repeatable views.
floor=mat('Stage | mist',(.68,.73,.76))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));register(bpy.context.object,'Ground',floor,'90_STAGE')
world=bpy.data.worlds.new('Soft Studio') if not bpy.data.worlds else bpy.data.worlds[0]
scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.77,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
def area(name,loc,power,size):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-3,-4,5),380,4);area('Fill',(3,-2,3),220,3);area('Rim',(1,3,4),450,3)
bpy.ops.object.camera_add(location=(2.4,-6,2.6));cam=bpy.context.object;cam.name='Portrait_Camera';cam.data.type='ORTHO';cam.data.ortho_scale=1.93;scene.camera=cam
def camera(loc,target,scale):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
camera((2.2,-6,2.25),(0,0,.85),1.91)
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
scene.view_settings.exposure=-1.5
scene.render.image_settings.file_format='PNG'

# Pack the chosen costume reference into the editable project.
ref=ROOT/'design'/'rin-outfits-01'/'02-academy.png'
if ref.exists():
    im=bpy.data.images.load(str(ref));im.pack()
    im.name='REFERENCE_Academy_Concept'

bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for o,_,_ in PARTS:o.select_set(True)
scene['Model status']='Procedural first-pass editable model; likeness, shoulder deformation and skirt movement need artist refinement.'
scene['Wardrobe']='Toggle 10_ACADEMY collection. All meshes share RIN_RIG; base coverage remains in 01_BODY.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rin_academy_v01.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'rin_academy_v01.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_morph=True,export_extras=True)
for filename,which in [('rin_base_v01.glb','base'),('outfit_academy_v01.glb','academy')]:
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for o,_,_ in PARTS:
        if o['outfit']==which:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_morph=True,export_extras=True)
report={'stage':'first-pass procedural model','bones':len(arm.bones),'meshes':len(PARTS),'vertices':sum(len(o.data.vertices) for o,_,_ in PARTS),'modules':{name:[o.name for o,_,_ in PARTS if o['module']==name] for name in COLS if name!='90_STAGE'},'sharedRig':rig.name,'reference':'design/rin-outfits-01/02-academy.png','limitations':['First-pass likeness; not production sculpt','Initial FK weights; skirt clipping possible in large motions','No IK, cloth physics or hair simulation','Blink and Talk are basic morph studies, not complete visemes']}
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
scene.render.filepath=str(PRE/'rin_academy_front.png');bpy.ops.render.render(write_still=True)
camera((2.8,6,2.4),(0,0,.85),1.91);scene.render.filepath=str(PRE/'rin_academy_back.png');bpy.ops.render.render(write_still=True)
camera((.6,-6,1.65),(0,-.025,1.435),.57);scene.render.filepath=str(PRE/'rin_academy_face.png');bpy.ops.render.render(write_still=True)
print('RIN_BUILD_COMPLETE',json.dumps(report))

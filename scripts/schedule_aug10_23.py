import re,json,time,urllib.request,urllib.error,sys,os
TOKEN='Ww6Wl7bG60RSZXaZ2kElS5WK_-1SstVIb_5c2gz1LWe'
ENDPOINT='https://api.buffer.com/graphql'
ORG='6a603e49b90c45bdaab82cee'
CHANNELS={'Instagram':'6a6156cee2638b94d7b9abf0','Facebook':'6a615653e2638b94d7b9aa6f','LinkedIn':'6a640853e2638b94d7ce2944'}
BASE='https://7d5924e3a6715d74efa480bc8bb2da91.ctonew.app/images/social/'
SRC='/home/team/shared/social/captions-aug10-23.md'
LOG='/tmp/aug10-23-buffer.log'

def gql(q):
    req=urllib.request.Request(ENDPOINT,data=json.dumps({'query':q}).encode(),headers={'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'},method='POST')
    try:
      with urllib.request.urlopen(req,timeout=60) as r:return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
      try:return e.code,json.loads(e.read().decode())
      except:return e.code,{'raw':str(e)}

def parse():
    s=open(SRC).read(); out=[]
    # headings carry exact platform/date/time
    pat=re.compile(r'^## (Instagram|Facebook|LinkedIn) — (Mon|Tue|Wed|Thu|Fri|Sat|Sun) ([A-Z][a-z]+ \d+) · ([0-9]+:[0-9]+ [AP]M) ET\n(.*?)(?=^---$|\Z)',re.M|re.S)
    for m in pat.finditer(s):
      platform,_,date,time_et,body=m.groups()
      im=re.search(r'^\*\*Image:\*\* (.+)$',body,re.M)
      cap=re.search(r'^\*\*Caption:\*\*\n(.*?)(?=^\*\*Hashtags:\*\*)',body,re.M|re.S)
      hs=re.search(r'^\*\*Hashtags:\*\*\n([^\n]+)',body,re.M)
      if not cap or not hs: raise Exception('missing fields '+platform+' '+date+' '+time_et)
      text=cap.group(1).strip()+'\n\n'+hs.group(1).strip()
      image=None
      if im:
        v=im.group(1).strip()
        if v.startswith('`') and v.endswith('`'): image=v[1:-1]
        elif v.startswith('Reuse `'): image=re.search(r'Reuse `([^`]+)`',v).group(1)
        elif v.startswith('None'): image=None
        else: raise Exception('bad image '+v)
      # ET -> UTC (Aug dates all EDT); next-day handling unnecessary at these slots
      month,day=date.split(); day=int(day)
      mon={'Aug':'08'}[month]
      h,minute=time_et[:-2].strip().split(':'); h=int(h); ap=time_et[-2:]
      if ap=='PM' and h!=12:h+=12
      if ap=='AM' and h==12:h=0
      due=f'2026-{mon}-{day:02d}T{h+4:02d}:{minute}:00.000Z'  # EDT = UTC-4, so add 4 hours
      out.append({'platform':platform,'date':date,'time':time_et,'due':due,'text':text,'image':image})
    return out

def existing(channel,due):
    q='''query { posts(input: {organizationId: "%s", filter: {channelIds: ["%s"], status: [scheduled], dueAt: {start: "%s", end: "%s"}}}, first: 50) { edges { node { id dueAt text status } } } }'''%(ORG,channel,due,due)
    status,data=gql(q)
    if status!=200 or data.get('errors'): raise Exception('duplicate query failed '+json.dumps(data)[:500])
    return (data.get('data',{}).get('posts',{}).get('edges',[]) or [])

def create(p):
    ch=CHANNELS[p['platform']]
    assets='[]' if not p['image'] else '[{image: {url: '+json.dumps(BASE+p['image'])+'}}]'
    metadata = {
        'Instagram': ', metadata: {instagram: {type: post, shouldShareToFeed: true}}',
        'Facebook': ', metadata: {facebook: {type: post}}',
        'LinkedIn': '',
    }[p['platform']]
    q='''mutation { createPost(input: {channelId: "%s", text: %s, dueAt: "%s", assets: %s, mode: customScheduled, needsApproval: false, schedulingType: automatic%s}) { __typename ... on PostActionSuccess { post { id dueAt status } } ... on InvalidInputError { message } } }'''%(ch,json.dumps(p['text']),p['due'],assets,metadata)
    return gql(q)

def main():
    posts=parse(); print('PARSED',len(posts),file=sys.stderr)
    if len(posts)!=58: raise Exception('expected 58, got '+str(len(posts)))
    open(LOG,'w').write('')
    for i,p in enumerate(posts,1):
      label=f"{i:02d} {p['platform']} {p['date']} {p['time']} {p['due']}"
      ok=False
      for attempt in range(1,4):
        status,data=create(p); cp=(data.get('data') or {}).get('createPost') or {}; post=cp.get('post') if isinstance(cp,dict) else None
        if post and post.get('id'):
          print('OK '+label+' '+post['id'],file=sys.stderr);open(LOG,'a').write('OK '+label+' '+post['id']+'\n');ok=True;break
        err_msg = json.dumps(data)[:300]
        print('FAIL attempt %d %s status=%s %s'%(attempt,label,status,err_msg),file=sys.stderr)
        if attempt<3: time.sleep(3)
      if not ok: open(LOG,'a').write('FAIL FINAL '+label+'\n')
      else: time.sleep(1.5)  # pace requests to avoid rate limiting
    print('LOG '+LOG,file=sys.stderr)
if __name__=='__main__':main()

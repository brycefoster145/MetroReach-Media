import re,json,time,urllib.request,urllib.error,sys,os
from datetime import datetime, timedelta
TOKEN='Ww6Wl7bG60RSZXaZ2kElS5WK_-1SstVIb_5c2gz1LWe'
ENDPOINT='https://api.buffer.com/graphql'
ORG='6a603e49b90c45bdaab82cee'
CHANNELS={'Instagram':'6a6156cee2638b94d7b9abf0','Facebook':'6a615653e2638b94d7b9aa6f','LinkedIn':'6a640853e2638b94d7ce2944'}
BASE='https://www.metroreachagency.com/images/social/'
SRC='/home/team/shared/social/captions-aug10-23.md'
LOG='/tmp/aug10-23-buffer.log'
# +21-day shift: original Aug 10-23 calendar -> fully-future window Mon Aug 31 -> Sun Sep 13, 2026.
# (Original brief said +14 = Aug 24 -> Sep 6, but execution date is Aug 24 evening, so day-one slots
#  were already in the past and Buffer rejected them with "Scheduled time must be in the future".
#  +21 lands on the next Monday with the full 58-post Mon-Sun structure entirely in the future.)
SHIFT_DAYS=21

def gql(q):
    req=urllib.request.Request(ENDPOINT,data=json.dumps({'query':q}).encode(),headers={'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'},method='POST')
    try:
      with urllib.request.urlopen(req,timeout=60) as r:return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
      try:return e.code,json.loads(e.read().decode())
      except:return e.code,{'raw':str(e)}

def verify_token():
    # Lightweight GraphQL query to confirm the token is still valid.
    # Returns True if authenticated (HTTP 200, no auth error). Stops on 401/invalid.
    q='''query { posts(input: {organizationId: "%s", filter: {status: [scheduled]}}) { edges { node { id status dueAt } } } }'''%ORG
    status,data=gql(q)
    if status==401 or status in (403,):
        raise SystemExit('TOKEN CHECK FAILED: HTTP %s — token invalid/expired. STOPPING. %s'%(status,json.dumps(data)[:300]))
    if status!=200:
        raise SystemExit('TOKEN CHECK ERROR: HTTP %s — cannot confirm token. STOPPING. %s'%(status,json.dumps(data)[:300]))
    body=json.dumps(data)
    if 'Invalid JWT' in body or 'Unauthorized' in body or 'not authorized' in body or 'FORBIDDEN' in body and 'posts' in body:
        raise SystemExit('TOKEN CHECK FAILED: auth error on posts query. STOPPING. %s'%body[:300])
    n=len((data.get('data',{}).get('posts',{}).get('edges') or []))
    print('TOKEN VALID — existing scheduled posts today: %d (target fresh window)'%n,file=sys.stderr)
    return True

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
      # ET -> UTC (EDT = UTC-4, so add 4 hours)
      month,day=date.split(); day=int(day)
      mon={'Aug':'08','Sep':'09','Jul':'07','Oct':'10'}[month]
      h,minute=time_et[:-2].strip().split(':'); h=int(h); ap=time_et[-2:]
      if ap=='PM' and h!=12:h+=12
      if ap=='AM' and h==12:h=0
      # shift forward by SHIFT_DAYS, crossing the month boundary if needed
      orig=datetime(2026,int(mon),int(day),0,0,0)
      shifted=orig+timedelta(days=SHIFT_DAYS)
      nmonth=shifted.month; nday=shifted.day
      due=f'2026-{nmonth:02d}-{nday:02d}T{h+4:02d}:{minute}:00.000Z'
      newdate='%s %d'%(['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][nmonth],nday)
      out.append({'platform':platform,'date':newdate,'time':time_et,'due':due,'text':text,'image':image})
    return out

def existing(channel,due):
    q='''query { posts(input: {organizationId: "%s", filter: {channelIds: ["%s"], status: [scheduled], dueAt: {start: "%s", end: "%s"}}}) { edges { node { id dueAt text status } } } }'''%(ORG,channel,due,due)
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

def is_rate_limited(data):
    try: return 'RATE_LIMIT' in json.dumps(data.get('errors') or '')
    except: return False

def main():
    verify_token()
    posts=parse(); print('PARSED',len(posts),file=sys.stderr)
    if len(posts)!=58: raise Exception('expected 58, got '+str(len(posts)))
    dates=sorted(p['due'] for p in posts)
    print('DATE RANGE %s -> %s'%(dates[0],dates[-1]),file=sys.stderr)
    print('FIRST MONDAY CHECK: '+'2026-08-24' in dates[0],file=sys.stderr)
    open(LOG,'w').write('')
    for i,p in enumerate(posts,1):
      label=f"{i:02d} {p['platform']} {p['date']} {p['time']} {p['due']}"
      ok=False
      backoffs=[5,15,45,90]
      for attempt in range(1,5):
        status,data=create(p); cp=(data.get('data') or {}).get('createPost') or {}; post=cp.get('post') if isinstance(cp,dict) else None
        if post and post.get('id'):
          print('OK '+label+' '+post['id'],file=sys.stderr);open(LOG,'a').write('OK '+label+' '+post['id']+'\n');ok=True;break
        err_msg = json.dumps(data)[:300]
        print('FAIL attempt %d %s status=%s %s'%(attempt,label,status,err_msg),file=sys.stderr)
        time.sleep(backoffs[attempt-1])  # escalting backoff (rate-limit friendly)
      if not ok: open(LOG,'a').write('FAIL FINAL '+label+'\n')
      else: time.sleep(2)  # pace requests to avoid rate limiting
    print('LOG '+LOG,file=sys.stderr)
if __name__=='__main__':main()

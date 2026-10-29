#!/usr/bin/env python3
import base64, json, os, smtplib, ssl, sys
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

from send_icloud_smtp import build_cv_pdf, CV_SOURCE

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

SMTP_HOST="smtp.mail.me.com"
SMTP_PORT=587
SENDER="ragunauthramsaroop@icloud.com"
SENDER_NAME="Ragunauth Ramsaroop"
WRAPPED_KEY=Path("outreach/secure/wrapped_private_key.json")
CV_PDF=Path("/tmp/Ragunauth_Ramsaroop_Executive_CV_2026.pdf")

FIRMS={
    "altiplanoheadhunters.com":("Altiplano Headhunters","retained senior executive search for mining, energy and heavy industry across Latin America","mining"),
    "mhpartners.co":("MH Partners","Dubai-based executive search for natural resources, mining, energy and ESG leadership","mining"),
    "corverconsulting.com":("Corver Consulting","UAE and Saudi Arabian executive search in clean energy, energy transition, utilities and government-linked infrastructure","energy"),
    "jamesalexandersearch.com":("James Alexander Search","leadership recruitment across regulated industries, energy, utilities, financial services and public policy","executive"),
    "public-affairs-network.com":("Public Affairs Network","Berlin-led executive search for government relations, policy and public affairs leadership","executive"),
    "ooption.com.mx":("Outstanding Option","executive and senior management search in Mexico and Latin America","executive"),
    "michaelpage.co.za":("Michael Page Africa","African and international senior leadership recruiting across industrial, infrastructure and corporate functions","mobility"),
    "konsac.com":("Konsac","executive search for senior leadership appointments across Spain and international companies","executive"),
    "darwinhawkins.com":("Darwin Hawkins","senior Irish sustainability, ESG governance and policy recruitment","energy"),
    "zacharydaniels.co.uk":("Zachary Daniels","executive and senior sustainability recruitment led by James Parr","energy"),
    "pure-fuel.com":("PureFuel","climate, clean energy and sustainability leadership hiring across London and Dubai","energy"),
    "intoclimate.com":("Into Climate","international climate-tech, renewable energy and sustainability executive search","energy"),
    "fletcher-jones.co.uk":("Fletcher Jones","retained senior appointments across governance, ESG and international institutional leadership","executive"),
    "grs-ltd.com":("Globalized Recruitment Services","international and cross-border executive candidate recruitment","mobility"),
    "joveinternational.com":("Jove International","confidential international executive search and corporate leadership mandates","executive"),
    "casuntrans.com":("Suntrans","cross-border mining executive and resource sector talent placement","mining"),
    "extractivesearch.com":("Extractive Search","global mining corporate, technical and ESG executive search","mining"),
    "faststream.com":("Faststream Recruitment","international executive search across maritime, shipping, infrastructure and globally mobile leadership","executive"),
    "trsstaffing.com":("TRS Staffing Solutions","global engineering, energy, infrastructure and project workforce recruitment","energy"),
    "leap29.com":("Leap29","international energy, renewables, technology and global mobility recruitment","energy"),
    "aerinternational.com":("AER International","specialist global mining recruitment and executive search across expatriate and remote-site markets","mining"),
    "rockpeople.com":("Rock People","international mining, resources and energy recruitment","mining"),
    "globe24-7.com":("Globe 24-7","global mining executive search and international talent mobility","mining"),
    "leaderengineering.com":("Leader Engineering","international energy and engineering recruitment","infrastructure"),
    "leaderguyana.com":("Leader Guyana","international project recruitment and cross-border talent mobilisation","infrastructure"),
    "petroplan.com":("Petroplan","global energy recruitment and international workforce mobilisation","energy"),
    "worldwide-rs.com":("Worldwide Recruitment Solutions","international energy, resources and project recruitment","energy"),
    "major-energy.com":("Major Energy","international energy workforce and mobility","energy"),
    "linumconsult.com":("Linum Consult","international infrastructure, construction and expatriate recruitment","infrastructure"),
    "brunel.net":("Brunel","global mobility and project recruitment across energy, mining and infrastructure","energy"),
    "atlasprofessionals.com":("Atlas Professionals","international energy, marine and project workforce recruitment","infrastructure"),
    "wqsrecruitment.com":("WQS Recruitment","international workforce and project recruitment","infrastructure"),
    "aps.com.na":("Africa Personnel Services","cross-border workforce recruitment across Africa","infrastructure"),
    "airswift.com":("Airswift","global workforce solutions and mobility across energy, infrastructure and resources","energy"),
    "big7placements.com":("Big7 Placements","international placements and global mobility","mobility"),
    "pgoilgasrecruitment.com":("PG Oil & Gas Recruitment","international oil, gas and energy recruitment","energy"),
    "imbm.com.cy":("IMBM","international staffing and cross-border workforce solutions","mobility"),
    "superior-recruitment.com":("Superior Recruitment","international engineering, energy and project recruitment","energy"),
    "energyrecruit.net":("EnergyRecruit","global energy and project recruitment","energy"),
    "projectglobalmining.com":("Project Global Mining","international mining recruitment with expatriate and FIFO assignments","mining"),
    "agcmining.co.za":("AGC Mining Recruitment","international mining and expatriate recruitment","mining"),
    "camining.com":("CA Mining","Africa and international mining executive search","mining"),
    "truemethod.uk":("True Method","global mining executive search and expatriate recruitment","mining"),
    "global-workforce.net":("Global Workforce","international workforce recruitment","mobility"),
    "oganlycareers.com":("Oganly Careers","international career and recruitment services","mobility"),
    "zafco.in":("ZAFCO International","overseas recruitment and workforce mobilisation","mobility"),
    "abroadex.com":("AbroadEx","international and overseas recruitment","mobility"),
    "westawayes.com.au":("Westaway Executive Search","executive search for mining and internationally operating organisations","mining"),
    "hireresolve.us":("Hire Resolve","international recruitment with global mining, engineering and executive coverage","mobility"),
    "hireresolve.za.com":("Hire Resolve","specialist mining recruitment with international coverage","mining"),
    "jamjobs.com":("JAM Global Mobility Recruitment","specialist global mobility, relocation and international assignment recruitment","mobility"),
}

def b64(s):
    return base64.b64decode(s)

def unwrap_private(password: bytes):
    obj=json.loads(WRAPPED_KEY.read_text(encoding="utf-8"))
    kdf=PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32, salt=b64(obj["salt"]),
        iterations=int(obj["iterations"]),
    )
    kek=kdf.derive(password)
    raw=AESGCM(kek).decrypt(
        b64(obj["nonce"]), b64(obj["ciphertext"]),
        b"icloud-outreach-private-key-v1",
    )
    return x25519.X25519PrivateKey.from_private_bytes(raw)

def greeting(to, firm):
    local=to.split("@",1)[0]
    first=local.split(".",1)[0]
    generic={"info","hello","enquiry","enquiries","expansion","emea","europe",
             "recruitment","guyanasuriname","houston","singapore","erbil","usa",
             "toronto","no","se","consultant","admin","contactus","swissing",
             "llaas","dscholtemeyer","lbaeza","mhuber","abouic","mining"}
    if first not in generic and len(first)>=3 and first.isalpha():
        return "Dear " + first.title() + ","
    return "Dear " + firm + " team,"

def build_campaign_message(to):
    domain=to.rsplit("@",1)[1].lower()
    firm,speciality,category=FIRMS.get(domain,("International Recruitment Team","global expatriate and international recruitment","mobility"))
    opener=(
        f"{greeting(to,firm)}\n\n"
        f"I am reaching out because {firm}'s work in {speciality} is closely aligned with the type of international leadership mandate I am pursuing. "
        "I would value consideration for senior non-technical assignments where institutional relationships, ESG credibility and disciplined operating execution materially influence business success."
    )
    profile=(
        "I currently serve as Liaison Director, Social Responsibility Department at AGM Inc., part of Zijin Gold International in Guyana. "
        "Across more than 12 years in multinational mining, regulated financial services and commercial operations, I have built experience in government and regulatory engagement, ESG and social performance, executive advisory, formal external communications and cross-functional coordination. "
        "I also support stakeholder engagement around a major industrial solar-and-battery programme and coordinated a cross-functional carbon-data evidence pilot."
    )
    if category=="mining":
        fit=(
            "For mining and resources clients, my value is strongest in Director or Head-level ESG, Social Performance, Government Relations, Corporate/External Affairs and Country Partnerships roles—particularly in emerging markets, remote operations and expatriate settings where licence-to-operate depends on trusted institutional relationships. "
            "I bring operating-side leadership and stakeholder execution rather than technical mine-engineering credentials."
        )
    elif category=="energy":
        fit=(
            "For energy and infrastructure clients, I am best aligned to Director or Head-level ESG, External Affairs, Government Relations, Stakeholder Strategy and Country Partnerships roles, especially where new investment or energy-transition projects require credible regulator, community and executive alignment. "
            "My contribution is corporate and institutional leadership rather than engineering design or construction management."
        )
    elif category=="infrastructure":
        fit=(
            "For internationally delivered projects, I am best aligned to Director or Head-level ESG, Corporate Affairs, Government Relations, Stakeholder Strategy and Country Partnerships roles. "
            "I bring the perspective of a regulated operating environment, where public-sector relationships, community commitments and internal execution have to remain tightly connected."
        )
    elif category=="mobility":
        fit=(
            "I am particularly interested in cross-border Director or Head-level ESG, Corporate Affairs, Government Relations, Strategic Partnerships and Country Leadership mandates. "
            "My background combines emerging-market operating experience with senior institutional engagement, making me relevant to employers seeking internationally mobile leaders who can move between corporate priorities, governments, regulators and communities."
        )
    else:
        fit=(
            "I am exploring Director or Head-level ESG, Corporate Affairs, External Relations, Government Relations, Strategic Partnerships and Country Leadership mandates with internationally operating organisations. "
            "My profile is strongest where business strategy, public institutions, sustainability commitments and operational accountability intersect."
        )
    close=(
        "I am English-speaking, internationally mobile and open to expatriate, residential or rotational assignments. "
        "I am available after a 30-day notice period and would require employer-supported work authorisation where applicable. "
        "My executive CV is attached. If my background aligns with a current or upcoming mandate, I would welcome a confidential discussion; replies can come directly to this iCloud address."
    )
    return {
        "to":to,
        "subject":f"International Expatriate Executive | ESG, Government Relations & Country Leadership | {firm}",
        "body":"\n\n".join([opener,profile,fit,close]),
    }

def decrypt_payload(path: Path, private_key):
    obj=json.loads(path.read_text(encoding="utf-8"))
    eph=x25519.X25519PublicKey.from_public_bytes(b64(obj["ephemeral_public"]))
    shared=private_key.exchange(eph)
    key=HKDF(
        algorithm=hashes.SHA256(), length=32, salt=b64(obj["salt"]),
        info=b"icloud-outreach-payload-v1",
    ).derive(shared)
    clear=AESGCM(key).decrypt(
        b64(obj["nonce"]), b64(obj["ciphertext"]),
        b"icloud-outreach-payload-v1",
    )
    payload=json.loads(clear.decode())
    messages=payload.get("messages")
    recipients=payload.get("recipients")
    if messages is not None:
        if not isinstance(messages,list) or not messages or len(messages)>10:
            raise ValueError("Payload must contain 1 to 10 messages.")
    elif recipients is not None:
        if payload.get("campaign")!="global-expat-executive-2026":
            raise ValueError("Unknown compact campaign.")
        if not isinstance(recipients,list) or not recipients or len(recipients)>10:
            raise ValueError("Compact payload must contain 1 to 10 recipients.")
        messages=[build_campaign_message(str(address).strip()) for address in recipients]
        payload["messages"]=messages
    else:
        raise ValueError("Payload must contain messages or recipients.")
    return payload

def attach_cv(msg: EmailMessage):
    if not CV_PDF.exists():
        build_cv_pdf(CV_SOURCE, CV_PDF)
    msg.add_attachment(
        CV_PDF.read_bytes(), maintype="application", subtype="pdf",
        filename="Ragunauth_Ramsaroop_Executive_CV_2026.pdf"
    )

def send(payload, password):
    ctx=ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST,SMTP_PORT,timeout=30) as server:
        server.ehlo()
        server.starttls(context=ctx)
        server.ehlo()
        server.login(SENDER,password.decode())
        for item in payload["messages"]:
            to=item["to"].strip()
            subject=item["subject"].strip()
            body=item["body"].strip()
            if "@" not in to or not subject or not body:
                raise ValueError("Invalid recipient, subject, or body.")
            msg=EmailMessage()
            msg["From"]=formataddr((SENDER_NAME,SENDER))
            msg["To"]=to
            msg["Subject"]=subject
            msg["Reply-To"]=SENDER
            msg.set_content(body)
            attach_cv(msg)
            server.send_message(msg, from_addr=SENDER, to_addrs=[to])
            print("Sent secure iCloud outreach message.")

def main():
    if len(sys.argv)!=2:
        raise SystemExit("Usage: secure_icloud_send.py <encrypted_payload.json>")
    password=os.environ.get("ICLOUD_APP_PASSWORD","").encode()
    if not password:
        raise SystemExit("ICLOUD_APP_PASSWORD is missing")
    private_key=unwrap_private(password)
    payload=decrypt_payload(Path(sys.argv[1]), private_key)
    send(payload,password)

if __name__=="__main__":
    main()

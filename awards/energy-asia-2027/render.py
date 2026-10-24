#!/usr/bin/env python3
"""AGM Inc. Eureka Award narrated video renderer: FFmpeg + Edge TTS."""
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = OUT / "source.mp4"
VOICE = OUT / "voice.mp3"
WORDS = OUT / "words.srt"
VOICE_FIT = OUT / "voice_fit.wav"
CAPTIONS = OUT / "English_Subtitles.srt"
FINAL = OUT / "AGM_Inc_Energy_Asia_Eureka_2027_Three_Minute_Pitch.mp4"
SCRIPT = (HERE / "narration.txt").read_text(encoding="utf-8").strip()
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REGULAR_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def run(args):
    print("RUN:", " ".join(str(a) for a in args)[:400], flush=True)
    subprocess.run([str(a) for a in args], check=True)

def length(file):
    return float(subprocess.check_output([
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(file)
    ], text=True).strip())

def seconds(stamp):
    hour, minute, both = stamp.split(":")
    second, milli = both.split(",")
    return int(hour)*3600 + int(minute)*60 + int(second) + int(milli)/1000

def stamp(t):
    n = int(round(max(0, t)*1000))
    return f"{n//3600000:02d}:{n//60000%60:02d}:{n//1000%60:02d},{n%1000:03d}"

def subtitles(old_length, new_length):
    data = WORDS.read_text(encoding="utf-8")
    rx = re.compile(r"\d+\s*\n(\d\d:\d\d:\d\d,\d\d\d)\s*-->\s*(\d\d:\d\d:\d\d,\d\d\d)\s*\n([^\n]+)")
    cues = [(seconds(a),seconds(b),txt.strip()) for a,b,txt in rx.findall(data) if txt.strip()]
    if not cues:
        raise RuntimeError("Speech generation did not return timed word subtitles.")
    ratio = new_length / old_length
    groups, words = [], []
    a=b=0
    for start,end,text in cues:
        if not words:
            a=start
        b=end
        words.append(text)
        if len(words)>=8 or b-a>=3.6 or (len(words)>=4 and text.endswith((".", "?", "!"))):
            groups.append((a,b," ".join(words)))
            words=[]
    if words:
        groups.append((a,b," ".join(words)))
    output=[]
    for i,(begin,end,text) in enumerate(groups,1):
        b=begin*ratio+4
        e=max(b+0.6,end*ratio+4)
        output.append(f"{i}\n{stamp(b)} --> {stamp(e)}\n{text}\n")
    CAPTIONS.write_text("\n".join(output),encoding="utf-8")
    print("Subtitle groups:",len(groups),flush=True)

def draw(filename,x,y,size,t0,t1,color="white",background=True):
    textpath=str(filename).replace(":",r"\:")
    terms=[f"drawtext=fontfile={FONT if size>=39 else REGULAR_FONT}",
        f"textfile={textpath}",f"x={x}",f"y={y}",
        f"fontsize={size}",f"fontcolor={color}",
        "shadowcolor=black@0.8","shadowx=2","shadowy=3",
        f"enable='between(t,{t0:.2f},{t1:.2f})'"]
    if background:
        terms.extend(["box=1","boxcolor=black@0.57","boxborderw=18"])
    return ":".join(terms)

def main():
    if not SOURCE.exists() or SOURCE.stat().st_size < 500000:
        raise RuntimeError("Source movie was not downloaded.")
    print("Original footage duration:",length(SOURCE),flush=True)
    run(["edge-tts","--voice","en-GB-RyanNeural","--rate=+0%",
         "--file",HERE/"narration.txt","--write-media",VOICE,
         "--write-subtitles",WORDS,"--no-progress"])
    old=length(VOICE)
    tempo=old/169.0
    if not 0.5<tempo<2:
        raise RuntimeError(f"Unexpected voice duration: {old}")
    run(["ffmpeg","-y","-hide_banner","-loglevel","error","-i",VOICE,
        "-af",f"atempo={tempo:.6f}","-ar","48000","-ac","2",VOICE_FIT])
    fitted=length(VOICE_FIT)
    subtitles(old,fitted)
    paragraphs=[p for p in re.split(r"\n\s*\n",SCRIPT) if p.strip()]
    titles=[
        ("AURORA HYBRID POWER TRANSITION","AGM Inc. | Energy Asia Awards 2027"),
        ("REMOTE MINING. RELIABLE POWER.","Moving beyond diesel dependency"),
        ("49.4 MW","Publicly reported installed solar capacity"),
        ("OPERATIONAL HYBRID ENERGY","Solar + battery storage + firm generation"),
        ("ANNUAL PROJECTIONS","63 GWh power | 18M litres diesel | 47,000 t CO2 avoided"),
        ("INDUSTRIAL INNOVATION","Technology integration and phased implementation"),
        ("LOCAL ECONOMIC VALUE","Around 100 construction jobs and skills development"),
        ("A MODEL FOR ASIA","Transferable principles for remote industrial operations"),
        ("FUTURE SCALING","Engineering and investment matched to demand"),
        ("RESILIENCE OVER TIME","Lower diesel dependence. Reliable industrial power."),
        ("AGM INC.","Aurora Hybrid Power Transition")
    ]
    if len(paragraphs)!=len(titles):
        raise RuntimeError(f"Expected 11 paragraphs, found {len(paragraphs)}")
    weights=[len(p.split()) for p in paragraphs]
    total=sum(weights)
    times=[4.0]
    running=0
    for w in weights:
        running+=w
        times.append(4.0 + fitted*running/total)
    header=OUT/"header.txt"
    header.write_text("AGM Inc. | ENERGY ASIA AWARDS 2027",encoding="utf-8")
    filters=["scale=1920:1080:force_original_aspect_ratio=increase",
        "crop=1920:1080","fps=30","eq=contrast=1.04:saturation=1.06",
        "drawbox=x=0:y=0:w=iw:h=90:color=black@0.38:t=fill",
        draw(header,60,23,26,0,179,background=False)]
    for i,(title,detail) in enumerate(titles):
        tfile=OUT/f"title_{i}.txt"
        dfile=OUT/f"detail_{i}.txt"
        tfile.write_text(title,encoding="utf-8")
        dfile.write_text(detail,encoding="utf-8")
        start=max(0,times[i]-0.1)
        end=min(179,times[i+1]-0.2)
        filters.append(draw(tfile,70,165,57,start,end))
        filters.append(draw(dfile,72,259,29,start,end,color="#F8D58B"))
    closing=OUT/"closing.txt"
    closing.write_text("AGM INC. | AURORA HYBRID POWER TRANSITION",encoding="utf-8")
    filters.append(draw(closing,95,470,46,174.5,179))
    srt=str(CAPTIONS).replace(":",r"\:")
    filters.append("subtitles="+srt+
       ":force_style='Fontname=DejaVu Sans,Fontsize=19,PrimaryColour=&H00FFFFFF,OutlineColour=&H00222222,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=43'")
    graph=",".join(filters)
    run(["ffmpeg","-y","-hide_banner","-loglevel","error",
        "-stream_loop","3","-i",SOURCE,"-i",VOICE_FIT,
        "-filter_complex",f"[0:v]{graph}[v];[1:a]adelay=4000|4000,apad=pad_dur=6[a]",
        "-map","[v]","-map","[a]","-t","179.0",
        "-c:v","libx264","-preset","veryfast","-crf","24",
        "-pix_fmt","yuv420p","-c:a","aac","-b:a","160k",
        "-movflags","+faststart",FINAL])
    got=length(FINAL)
    print("Final duration",got,"file",FINAL,"size",FINAL.stat().st_size,flush=True)
    if got>180 or got<175:
        raise RuntimeError(f"Award time limit not satisfied: {got}")
    (OUT/"README.txt").write_text(
        f"AGM Inc. Energy Asia Eureka Award 2027\nFinal runtime: {got:.2f}s\n"
        "Narration: English male neural voice\n"
        "English captions embedded and supplied as SRT\n"
        "Annual figures clearly identified as forecasts\n",
        encoding="utf-8")
if __name__=="__main__":
    main()

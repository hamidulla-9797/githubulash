-- Montaj.app
--  • videoni ikonka ustiga tashlang → avto montaj
--  • ssenariy papkasini (script.md + ovoz + logo) tashlang → kamerasiz rolik
--  • ochib, "Yangi rolik" tanlang → ssenariy shabloni bilan papka yaratiladi
property asos : (POSIX path of (path to home folder)) & "VideoMontaj/"

on run
	set tanlov to button returned of (display dialog "Nima qilamiz?" with title "Montaj" buttons {"Yangi rolik (ssenariydan)", "Video montaj"} default button "Video montaj")
	if tanlov is "Video montaj" then
		set fs to choose file with prompt "Montaj qilinadigan video(lar)ni tanlang:" of type {"public.movie"} with multiple selections allowed
		ishla(fs)
	else
		yangi_rolik()
	end if
end run

on open fs
	ishla(fs)
end open

on papkami(f)
	return (do shell script "test -d " & quoted form of POSIX path of f & " && echo 1 || echo 0") is "1"
end papkami

on uslub_tanla()
	set nomlar to paragraphs of (do shell script "cd " & quoted form of (asos & "assets/uslublar") & " && ls *.json | sed 's/\\.json$//'")
	if (count of nomlar) < 2 then return "asosiy"
	set t to choose from list nomlar with title "Montaj" with prompt "Uslub (brend ranglari):" default items {"asosiy"}
	if t is false then error number -128
	return item 1 of t
end uslub_tanla

on ishla(fs)
	set rolikmi to papkami(item 1 of fs)
	if rolikmi then
		set formatlar to {"Reels / Stories (9:16)", "Kvadrat (1:1)", "YouTube (16:9)"}
		set dflt to "Reels / Stories (9:16)"
	else
		set formatlar to {"Asl o'lcham", "Reels / Stories (9:16)", "Kvadrat (1:1)", "YouTube (16:9)"}
		set dflt to "Asl o'lcham"
	end if
	set tanlov to choose from list formatlar with title "Montaj" with prompt "Video formati:" default items {dflt}
	if tanlov is false then return
	set t to item 1 of tanlov
	if t starts with "Reels" then
		set fmt to "9:16"
	else if t starts with "Kvadrat" then
		set fmt to "1:1"
	else if t starts with "YouTube" then
		set fmt to "16:9"
	else
		set fmt to "asl"
	end if
	set sub to "ha"
	set stk to "yoq"
	set rejim to "oddiy"
	set til to "uz"
	if not rolikmi then
		set r to button returned of (display dialog "Montaj turi:" & return & return & "REEL STUDIO — so'zma-so'z subtitr, kutubxonadagi stikerlar (ma'nosiga qarab), zoom, Instagram xavfsiz zonasi" & return & return & "ODDIY — tez: kesish + subtitr" with title "Montaj" buttons {"Oddiy", "Reel Studio"} default button "Reel Studio")
		if r is "Reel Studio" then set rejim to "reel"
		set tt to choose from list {"O'zbekcha", "English", "Русский"} with title "Montaj" with prompt "Videodagi nutq tili:" default items {"O'zbekcha"}
		if tt is false then return
		if item 1 of tt is "English" then set til to "en"
		if item 1 of tt is "Русский" then set til to "ru"
	end if
	if not rolikmi and rejim is "oddiy" then
		set javob to button returned of (display dialog "O'zbekcha subtitr qo'shilsinmi?" with title "Montaj" buttons {"Yo'q", "Ha"} default button "Ha")
		if javob is "Yo'q" then set sub to "yoq"
		set javob2 to button returned of (display dialog "iPhone stikerlari (🔥💰🚀) kalit so'zlarga qo'shilsinmi?" with title "Montaj" buttons {"Yo'q", "Ha"} default button "Ha")
		if javob2 is "Ha" then set stk to "ha"
	end if
	set usl to uslub_tanla()
	set yollar to ""
	repeat with f in fs
		set yollar to yollar & " " & quoted form of POSIX path of f
	end repeat
	tell application "Terminal"
		activate
		do script quoted form of (asos & "app/montaj_ishga.sh") & " " & fmt & " " & sub & " " & stk & " " & usl & " " & rejim & " " & til & yollar
	end tell
end ishla

on yangi_rolik()
	set nom to text returned of (display dialog "Rolik nomi (papka nomi):" with title "Yangi rolik" default answer "rolik")
	set p to do shell script quoted form of (asos & "app/yangi_rolik.sh") & " " & quoted form of nom
	display dialog "Papka tayyor:" & return & p & return & return & "1) script.md ga matnni yozing (har # sarlavha — bitta kadr)" & return & "2) Ovoz faylini (wav/mp3/m4a) shu papkaga qo'ying" & return & "3) logo.png (ixtiyoriy)" & return & return & "Keyin papkani Montaj ikonkasi ustiga tashlang." with title "Yangi rolik" buttons {"OK"} default button "OK"
end yangi_rolik

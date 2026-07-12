// NovaVend Avatar Linker — independently authored clean-room bootstrap client.
// Replace API_BASE_URL with the HTTPS URL of a hosted NovaVend API.
string API_BASE_URL = "https://api.example.invalid";
string PROTOCOL_VERSION = "2026-01";
integer privateChannel;
integer listener;
key owner;
key requestId;
string pairingToken;

clearTemporaryState() { if (listener != 0) llListenRemove(listener); listener = 0; pairingToken = ""; llSetTimerEvent(0.0); }
ownerMessage(string message) { llRegionSayTo(owner, 0, "NovaVend: " + message); }

default
{
    state_entry() { owner = llGetOwner(); clearTemporaryState(); ownerMessage("Touch this object to enter a one-time avatar pairing token."); }
    changed(integer change) { if (change & CHANGED_OWNER) llResetScript(); }
    touch_start(integer count)
    {
        if (llDetectedKey(0) != owner) return;
        clearTemporaryState();
        privateChannel = -1000000 - (integer)llFrand(1000000000.0);
        listener = llListen(privateChannel, "", owner, "");
        llTextBox(owner, "Paste the short-lived NovaVend pairing token. It will be sent once and then cleared.", privateChannel);
        llSetTimerEvent(60.0);
    }
    listen(integer channel, string name, key speaker, string message)
    {
        if (channel != privateChannel || speaker != owner) return;
        pairingToken = llStringTrim(message, STRING_TRIM);
        if (llStringLength(pairingToken) < 20) { ownerMessage("The pairing token is invalid."); clearTemporaryState(); return; }
        string payload = llList2Json(JSON_OBJECT, ["pairingToken", pairingToken]);
        string envelope = llList2Json(JSON_OBJECT, ["version", PROTOCOL_VERSION, "deviceType", "avatar_link", "deviceId", (string)llGetKey(), "messageId", (string)llGenerateKey(), "sentAt", llGetTimestamp()]);
        envelope = llJsonSetValue(envelope, ["payload"], payload);
        requestId = llHTTPRequest(API_BASE_URL + "/secondlife/v1/avatar-pairings/claim", [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json", HTTP_BODY_MAXLENGTH, 8192], envelope);
        pairingToken = "";
        if (listener != 0) llListenRemove(listener);
        listener = 0;
        llSetTimerEvent(30.0);
        ownerMessage("Pairing request sent securely.");
    }
    http_response(key id, integer status, list metadata, string body)
    {
        if (id != requestId) return;
        string code = llJsonGetValue(body, ["code"]);
        if (status >= 200 && status < 300) ownerMessage("Avatar linked successfully (" + code + ").");
        else if (status == 429) ownerMessage("Too many attempts. Wait before trying again.");
        else if (status == 503) ownerMessage("The pairing service is temporarily unavailable.");
        else if (status == 404) ownerMessage("The token is invalid or no longer available.");
        else if (status == 409) ownerMessage("This token was already used by another avatar.");
        else if (status == 410) ownerMessage("The token expired or was cancelled.");
        else ownerMessage("Pairing failed. Check the token and try again.");
        clearTemporaryState();
    }
    timer() { ownerMessage("Pairing input or request timed out. No token was retained."); clearTemporaryState(); }
    on_rez(integer start) { llResetScript(); }
}

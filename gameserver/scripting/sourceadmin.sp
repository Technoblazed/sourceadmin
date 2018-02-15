#include <sourcemod>
#include <logdebug>
#include <ripext>
#include <sockets>
#include <sourceadmin>

#pragma newdecls required
#pragma semicolon 1

ArrayList g_aCommandQueue;
ArrayList g_aReasons;

char g_sReasonsFile[256];
char g_sServerIP[16];

ConVar g_cHostName;
ConVar g_cBroadcastNames;
ConVar g_cHideTriggers;
ConVar g_cSocketAddress;
ConVar g_cSocketMaxRetries;
ConVar g_cSocketPassword;
ConVar g_cSocketPort;
ConVar g_cReportImmunity;

int g_iRetries;
int g_iReportTarget[MAXPLAYERS + 1];

static char g_sColorNames[][] =
{
	"{WHITE}",
	"{DARK_RED}",
	"{PINK}",
	"{GREEN}",
	"{YELLOW}",
	"{LIGHT_GREEN}",
	"{LIGHT_RED}",
	"{GRAY}",
	"{ORANGE}",
	"{LIGHT_BLUE}",
	"{DARK_BLUE}",
	"{PURPLE}"
};

static char g_sColorCodes[][] =
{
	"\x01",
	"\x02",
	"\x03",
	"\x04",
	"\x05",
	"\x06",
	"\x07",
	"\x08",
	"\x09",
	"\x0B",
	"\x0C",
	"\x0E"
};

enum SocketStatus
{
	eSocket_Closed,
	eSocket_Disconnected,
	eSocket_Connecting,
	eSocket_Connected
}

Handle g_hSocketHandle;

SocketStatus g_sSocketStatus = eSocket_Closed;

public Plugin myinfo =
{
	name = "SourceAdmin",
	author = "Techno <i.will@spamthe.world>",
	description = "SourceAdmin - The Simple CallAdmin Software",
	version = "1.0.0",
	url = "https://github.com/technoblazed/sourceadmin"
};

public void OnPluginStart()
{
	InitDebugLog("sm_sourceadmin_debug", "SA", ADMFLAG_GENERIC);

	LoadTranslations("sourceadmin.phrases.txt");

	g_cHostName = FindConVar("hostname");

	g_cBroadcastNames = CreateConVar("sm_sourceadmin_broadcast_names", "1", "Should admin names be broadcasted when using the online chat system", _, true, 0.0, true, 1.0);
	g_cHideTriggers = CreateConVar("sm_sourceadmin_hide_triggers", "1", "Should chat triggers be hidden from being displayed to chat", _, true, 0.0, true, 1.0);
	g_cSocketAddress = CreateConVar("sm_sourceadmin_address", "localhost", "Address of the SourceAdmin server", FCVAR_PROTECTED);
	g_cSocketMaxRetries = CreateConVar("sm_sourceadmin_max_retries", "30", "Maximum amount of times the server will attempt to reconnect to the socket server", _, true, 0.0);
	g_cSocketPassword = CreateConVar("sm_sourceadmin_password", "magicalbacon", "Password for the SourceAdmin server", FCVAR_PROTECTED);
	g_cSocketPort = CreateConVar("sm_sourceadmin_port", "19857", "Port of the SourceAdmin server", FCVAR_PROTECTED, true, 1.0);
	g_cReportImmunity = CreateConVar("sm_sourceadmin_immunity", "2", "Determines admin immunity to the report feature.\n0) Admins cannot be reported and will not be displayed inside the report menu.\n1) Admins can be reported in the same way as other players.\n2) Admins will be displayed in the report menu, but reports will not be sent", _, true, 0.0, true, 2.0);

	AutoExecConfig(true, "sourceadmin");

	RegConsoleCmd("sm_call", Command_Report, "Open up the report player menu");
	RegConsoleCmd("sm_report", Command_Report, "Open up the report player menu");

	AddCommandListener(CommandListener_Say, "say");
	AddCommandListener(CommandListener_SayTeam, "say_team");

	g_sSocketStatus = eSocket_Disconnected;

	g_aCommandQueue = new ArrayList(ByteCountToCells(4096));
	g_aReasons = new ArrayList(ByteCountToCells(128));

	BuildPath(Path_SM, g_sReasonsFile, sizeof(g_sReasonsFile), "configs/sourceadmin_reasons.cfg");
	if (!FileExists(g_sReasonsFile, false, "GAME"))
	{
		GenerateReasonFile();
	}

	BuildIP();
	ParseReasonsFile();
}

public void OnConfigsExecuted()
{
	if (g_sSocketStatus == eSocket_Disconnected)
	{
		ConnectToSocket();
	}
}

public APLRes AskPluginLoad2(Handle hMyself, bool bLate, char[] sError, int iErrMax)
{
	CreateNative("SourceAdmin_PrintToChat", Native_PrintToChat);

	RegPluginLibrary("SourceAdmin");

	return APLRes_Success;
}

/**
 *	Socket Connection Mannagement
 */

public void ConnectToSocket()
{
	char sHost[16];

	g_cSocketAddress.GetString(sHost, sizeof(sHost));

	g_sSocketStatus = eSocket_Connecting;

	g_hSocketHandle = SocketCreate(SOCKET_TCP, OnSocketError);

	SocketSetOption(g_hSocketHandle, SocketReceiveTimeout, 5000);
	SocketSetOption(g_hSocketHandle, SocketSendTimeout, 5000);

	SocketConnect(g_hSocketHandle, OnSocketConnected, OnSocketReceive, OnSocketDisconnect, sHost, g_cSocketPort.IntValue);
}

public int OnSocketConnected(Handle hSocket, any arg)
{
	g_iRetries = 0;
	g_sSocketStatus = eSocket_Connected;

	ProcessSocketOutbound();
}

public int OnSocketDisconnect(Handle hSocket, any arg)
{
	delete g_hSocketHandle;

	g_sSocketStatus = eSocket_Disconnected;

	CreateTimer(5.0, Timer_ProcessData);
}

public Action Timer_ProcessData(Handle hTimer)
{
	g_iRetries++;

	if (g_iRetries > g_cSocketMaxRetries.IntValue)
	{
		SetFailState("[SourceAdmin] Maximum connection retries reached. (%i/%i)", g_iRetries, g_cSocketMaxRetries.IntValue);
	}

	ProcessSocketOutbound();
}

public int OnSocketError(Handle hSocket, const int iErrorType, const int iErrorNum, any arg)
{
	delete g_hSocketHandle;

	g_sSocketStatus = eSocket_Closed;

	CreateTimer(5.0, Timer_ProcessData);
}

/**
 *	Socket Processing - Inbound
 */

public int OnSocketReceive(Handle hSocket, const char[] sReceiveData, const int iDataSize, any arg)
{
	char sLocalPassword[64];
	char sPassword[64];
	char sType[32];

	g_cSocketPassword.GetString(sLocalPassword, sizeof(sLocalPassword));

	JSONObject jReceiveObject = JSONObject.FromString(sReceiveData);

	bool bPasswordFound = jReceiveObject.GetString("password", sPassword, sizeof(sPassword));
	bool bTypeFound = jReceiveObject.GetString("type", sType, sizeof(sType));

	if (!bPasswordFound || !StrEqual(sLocalPassword, sPassword))
	{
		return;
	}

	if (bTypeFound)
	{
		if (StrEqual(sType, "auth"))
		{
			char sHostname[128];

			g_cHostName.GetString(sHostname, sizeof(sHostname));

			JSONObject jAuthObject = new JSONObject();

			jAuthObject.SetString("type", "auth");
			jAuthObject.SetString("password", sLocalPassword);
			jAuthObject.SetString("hostname", sHostname);

			PushRequest(jAuthObject);

			delete jAuthObject;
		}
		else if (StrEqual(sType, "chat"))
		{
			char sMessage[256];
			char sName[64];

			jReceiveObject.GetString("message", sMessage, sizeof(sMessage));
			jReceiveObject.GetString("name", sName, sizeof(sName));

			BroadcastAdminMessage(sName, sMessage);
		}
		else if (StrEqual(sType, "cvar"))
		{
			char sAuth[18];
			char sCvar[256];
			char sResult[256];
			char sUUID[64];

			jReceiveObject.GetString("auth", sAuth, sizeof(sAuth));
			jReceiveObject.GetString("cvar", sCvar, sizeof(sCvar));
			jReceiveObject.GetString("uuid", sUUID, sizeof(sUUID));

			ServerCommandEx(sResult, sizeof(sResult), "sm_cvar %s", sCvar);

			JSONObject jResponseObject = new JSONObject();

			jResponseObject.SetString("type", "map");
			jResponseObject.SetString("auth", sAuth);
			jResponseObject.SetString("uuid", sUUID);
			jResponseObject.SetString("response", sResult);

			PushRequest(jResponseObject);

			delete jResponseObject;
		}
		else if (StrEqual(sType, "kick"))
		{
			char sAuth[18];
			char sReason[64];
			char sResult[256];
			char sUUID[64];

			jReceiveObject.GetString("auth", sAuth, sizeof(sAuth));
			jReceiveObject.GetString("uuid", sUUID, sizeof(sUUID));

			int iTarget = jReceiveObject.GetInt("target");

			ServerCommandEx(sResult, sizeof(sResult), "sm_kick #%i %s", iTarget, sReason);

			JSONObject jResponseObject = new JSONObject();

			jResponseObject.SetString("type", "kick");
			jResponseObject.SetString("auth", sAuth);
			jResponseObject.SetString("uuid", sUUID);
			jResponseObject.SetString("response", sResult);

			PushRequest(jResponseObject);

			delete jResponseObject;
		}
		else if (StrEqual(sType, "map"))
		{
			char sAuth[18];
			char sMapname[PLATFORM_MAX_PATH];
			char sReason[64];
			char sUUID[64];

			jReceiveObject.GetString("auth", sAuth, sizeof(sAuth));
			jReceiveObject.GetString("map", sMapname, sizeof(sMapname));
			jReceiveObject.GetString("uuid", sUUID, sizeof(sUUID));

			JSONObject jResponseObject = new JSONObject();

			jResponseObject.SetString("type", "map");
			jResponseObject.SetString("auth", sAuth);
			jResponseObject.SetString("uuid", sUUID);

			if (IsMapValid(sMapname))
			{
				jResponseObject.SetBool("success", true);

				Format(sReason, sizeof(sReason), "SourceAdmin: sm_map - %s", sAuth);

				ForceChangeLevel(sMapname, sReason);
			}
			else
			{
				jResponseObject.SetBool("success", false);
			}

			PushRequest(jResponseObject);

			delete jResponseObject;
		}
		else if (StrEqual(sType, "rcon"))
		{
			char sAuth[18];
			char sCommand[256];
			char sResult[256];
			char sUUID[64];

			jReceiveObject.GetString("auth", sAuth, sizeof(sAuth));
			jReceiveObject.GetString("command", sCommand, sizeof(sCommand));
			jReceiveObject.GetString("uuid", sUUID, sizeof(sUUID));

			ServerCommandEx(sResult, sizeof(sResult), "sm_rcon %s", sCommand);

			JSONObject jResponseObject = new JSONObject();

			jResponseObject.SetString("type", "map");
			jResponseObject.SetString("auth", sAuth);
			jResponseObject.SetString("uuid", sUUID);
			jResponseObject.SetString("response", sResult);

			PushRequest(jResponseObject);

			delete jResponseObject;
		}
		else if (StrEqual(sType, "refresh"))
		{
			char sHostname[128];
			char sMapname[PLATFORM_MAX_PATH];

			g_cHostName.GetString(sHostname, sizeof(sHostname));

			GetCurrentMap(sMapname, sizeof(sMapname));

			JSONObject jRefreshObject = new JSONObject();

			jRefreshObject.SetString("type", "refresh");

			jRefreshObject.SetString("hostname", sHostname);
			jRefreshObject.SetString("map", sMapname);

			jRefreshObject.SetInt("maxPlayers", GetMaxHumanPlayers());
			jRefreshObject.SetInt("players", GetClientCount(false));

			PushRequest(jRefreshObject);

			delete jRefreshObject;
		}
		else if (StrEqual(sType, "players"))
		{
			JSONArray jPlayersArray = new JSONArray();

			char sAuth[32];
			char sName[MAX_NAME_LENGTH];

			int iUser;

			for (int i = 1; i <= MaxClients; i++)
			{
				if (IsValidClient(i))
				{
					GetClientAuthId(i, AuthId_SteamID64, sAuth, sizeof(sAuth));
					GetClientName(i, sName, sizeof(sName));

					iUser = GetClientUserId(i);

					JSONObject jPlayerObject = new JSONObject();

					jPlayerObject.SetInt("id", iUser);
					jPlayerObject.SetString("auth", sAuth);
					jPlayerObject.SetString("name", sName);

					jPlayersArray.Push(jPlayerObject);

					delete jPlayerObject;
				}
			}

			JSONObject jPlayersObject = new JSONObject();

			jPlayersObject.SetString("type", "players");

			jPlayersObject.Set("playerList", jPlayersArray);

			PushRequest(jPlayersObject);

			delete jPlayersArray;
			delete jPlayersObject;
		}
		else if (StrEqual(sType, "error"))
		{
			char sError[256];

			jReceiveObject.GetString("data", sError, sizeof(sError));

			SetFailState("%s", sError);
		}
	}

	delete jReceiveObject;
}

/**
 *	Socket Processing - Outbound
 */

public void ProcessSocketOutbound()
{
	if (g_sSocketStatus == eSocket_Closed)
	{
		g_hSocketHandle = SocketCreate(SOCKET_TCP, OnSocketError);
		g_sSocketStatus = eSocket_Disconnected;
	}

	if (g_sSocketStatus == eSocket_Disconnected)
	{
		ConnectToSocket();
	}

	if (g_sSocketStatus == eSocket_Connected)
	{
		char sBuffer[4096];

		while (g_aCommandQueue.Length > 0)
		{
			int item = g_aCommandQueue.GetString(0, sBuffer, sizeof(sBuffer));

			SocketSend(g_hSocketHandle, sBuffer, item);

			g_aCommandQueue.Erase(0);
		}
	}
}

public void PushRequest(JSONObject jObject)
{
	char sBuffer[4096];

	jObject.ToString(sBuffer, sizeof(sBuffer));

	StrCat(sBuffer, sizeof(sBuffer), "\n");

	g_aCommandQueue.PushString(sBuffer);

	ProcessSocketOutbound();
}

/**
 *	Command Processing
 */

public Action Command_Report(int iClient, int iArgs)
{
	Menu mReportMenu = new Menu(ReportMenuHandler);

	mReportMenu.SetTitle("%T", "SelectClient", iClient);

	bool bIsAdmin;

	char sName[MAX_NAME_LENGTH];
	char sSerial[24];

	int iClients;

	for (int i = 1; i <= MaxClients; i++)
	{
		bIsAdmin = CheckCommandAccess(i, "sourceadmin_command", ADMFLAG_GENERIC);

		if (i != iClient && IsValidClient(i) && (!bIsAdmin || (bIsAdmin && g_cReportImmunity.IntValue != 0)))
		{
			iClients++;

			GetClientName(i, sName, sizeof(sName));

			Format(sSerial, sizeof(sSerial), "%d", GetClientSerial(i));

			mReportMenu.AddItem(sSerial, sName);
		}
	}

	if (iClients == 0)
	{
		char sFormat[64];

		Format(sFormat, sizeof(sFormat), "%T", "NoClientsFound", iClient);

		mReportMenu.AddItem("-1", sFormat, ITEMDRAW_DISABLED);
	}

	mReportMenu.Display(iClient, MENU_TIME_FOREVER);

	return Plugin_Handled;
}

public int ReportMenuHandler(Menu mMenu, MenuAction maAction, int iParam1, int iParam2)
{
	if (maAction == MenuAction_Select)
	{
		char sInfo[24];

		int iSerial;
		int iTarget;

		mMenu.GetItem(iParam2, sInfo, sizeof(sInfo));

		iSerial = StringToInt(sInfo);
		iTarget = GetClientFromSerial(iSerial);

		if (!IsValidClient(iTarget))
		{
			SourceAdmin_PrintToChat(iParam1, "%T", "ClientDisconnected", iParam1);
		}
		else
		{
			g_iReportTarget[iParam1] = iTarget;

			DrawBanReasons(iParam1);
		}
	}
	else if (maAction == MenuAction_End)
	{
		delete mMenu;
	}
}

public void DrawBanReasons(int iClient)
{
	Menu mReasonsMenu = new Menu(ReasonsMenuHandler);

	mReasonsMenu.SetTitle("%T", "SelectReason", iClient);

	char sReason[128];

	int iIndex;
	int iReasons;

	for (int i; i <= g_aReasons.Length - 1; i++)
	{
		g_aReasons.GetString(i, sReason, sizeof(sReason));

		if (strlen(sReason) < 3)
		{
			continue;
		}

		iReasons++;

		mReasonsMenu.AddItem(sReason[iIndex], sReason[iIndex]);
	}

	if (iReasons == 0)
	{
		char sFormat[64];

		Format(sFormat, sizeof(sFormat), "%T", "NoReasonsFound", iClient);

		mReasonsMenu.AddItem("-1", sFormat, ITEMDRAW_DISABLED);
	}

	mReasonsMenu.Display(iClient, MENU_TIME_FOREVER);
}

public int ReasonsMenuHandler(Menu mMenu, MenuAction maAction, int iParam1, int iParam2)
{
	if (maAction == MenuAction_Select)
	{
		char sInfo[24];

		mMenu.GetItem(iParam2, sInfo, sizeof(sInfo));

		if (!IsValidClient(g_iReportTarget[iParam1]))
		{
			SourceAdmin_PrintToChat(iParam1, "%T", "ClientDisconnected", iParam1);
		}
		else
		{
			CreateReport(iParam1, g_iReportTarget[iParam1], sInfo);
		}
	}
	else if (maAction == MenuAction_End)
	{
		delete mMenu;
	}
}

/**
 *	Chat Processing
 */

public Action CommandListener_Say(int iClient, const char[] sCommand, int iArgc)
{
	char sMessage[192];

	GetCmdArgString(sMessage, sizeof(sMessage));

	OnChatMessage(iClient, sMessage, 1);

	if (g_cHideTriggers.BoolValue)
	{
		char sMessageLower[192];

		StrToLower(sMessage, sMessageLower, sizeof(sMessageLower));

		if (StrEqual(sMessageLower, "!call") || StrEqual(sMessageLower, "!report"))
		{
			return Plugin_Handled;
		}
	}

	return Plugin_Continue;
}

public Action CommandListener_SayTeam(int iClient, const char[] sCommand, int iArgc)
{
	char sMessage[192];

	GetCmdArgString(sMessage, sizeof(sMessage));

	OnChatMessage(iClient, sMessage, 2);

	if (g_cHideTriggers.BoolValue)
	{
		char sMessageLower[192];

		StrToLower(sMessage, sMessageLower, sizeof(sMessageLower));

		if (StrEqual(sMessageLower, "!call") || StrEqual(sMessageLower, "!report"))
		{
			return Plugin_Handled;
		}
	}

	return Plugin_Continue;
}

public void OnChatMessage(int iClient, char[] sMessage, int iType)
{
	if (!IsValidClient(iClient))
	{
		return;
	}

	StripQuotes(sMessage);

	if (strlen(sMessage) < 1)
	{
		return;
	}

	char sName[64];
	char sSteamID[20];

	GetClientName(iClient, sName, sizeof(sName));
	GetClientAuthId(iClient, AuthId_SteamID64, sSteamID, sizeof(sSteamID));

	JSONObject jChatObject = new JSONObject();

	jChatObject.SetString("type", (iType == 1) ? "chat" : "chat_team");
	jChatObject.SetString("message", sMessage);
	jChatObject.SetString("name", sName);
	jChatObject.SetString("steam", sSteamID);

	PushRequest(jChatObject);

	delete jChatObject;
}

public void BroadcastAdminMessage(const char[] sName, const char[] sMessage)
{
	char sPrefix[256];

	Format(sPrefix, sizeof(sPrefix), "%T", "BroadcastAdminMessage", LANG_SERVER, g_cBroadcastNames.BoolValue ? sName : "Admin");

	Colorize(sPrefix, sizeof(sPrefix));

	PrintToChatAll("%s %s", sPrefix, sMessage);
}

public int Native_PrintToChat(Handle hPlugin, int iNumParams)
{
	int iClient = GetNativeCell(1);

 	if (!IsValidClient(iClient))
 	{
	 	return;
 	}

  	char buffer[1024];
  	int bytesWritten = 0;

  	SetGlobalTransTarget(iClient);
  	FormatNativeString(0, 2, 3, sizeof(buffer), bytesWritten, buffer);

  	char sMessage[1024];

	Format(sMessage, sizeof(sMessage), "%T %s", "Prefix", iClient, buffer);

  	if (iClient == 0)
	{
		Colorize(sMessage, sizeof(sMessage));

		PrintToConsole(iClient, sMessage);
  	}
	else if (IsClientInGame(iClient))
	{
		Colorize(sMessage, sizeof(sMessage));

		PrintToChat(iClient, sMessage);
  	}
}

/**
 *	Report Processing
 */

public void CreateReport(int iClient, int iTarget, const char[] sReason)
{
	char sClientAddress[16];
	char sClientAuth[32];
	char sClientName[MAX_NAME_LENGTH];

	char sTargetAddress[16];
	char sTargetAuth[32];
	char sTargetName[MAX_NAME_LENGTH];

	GetClientIP(iClient, sClientAddress, sizeof(sClientAddress));
	GetClientIP(iClient, sTargetAddress, sizeof(sTargetAddress));

	GetClientName(iClient, sClientName, sizeof(sClientName));
	GetClientName(iTarget, sTargetName, sizeof(sTargetName));

	GetClientAuthId(iClient, AuthId_SteamID64, sClientAuth, sizeof(sClientAuth));
	GetClientAuthId(iTarget, AuthId_SteamID64, sTargetAuth, sizeof(sTargetAuth));

	JSONObject jReportObject = new JSONObject();

	jReportObject.SetString("type", "report");
	jReportObject.SetString("reason", sReason);

	jReportObject.SetString("cAddress", sClientAddress);
	jReportObject.SetString("tAddress", sTargetAddress);

	jReportObject.SetString("cAuth", sClientAuth);
	jReportObject.SetString("tAuth", sTargetAuth);

	jReportObject.SetString("cName", sClientName);
	jReportObject.SetString("tName", sTargetName);

	if (!CheckCommandAccess(iTarget, "sourceadmin_command", ADMFLAG_GENERIC) || g_cReportImmunity.IntValue == 1)
	{
		PushRequest(jReportObject);
	}

	delete jReportObject;

	SourceAdmin_PrintToChat(iClient, "%T", "ReportCreated", iClient, sTargetName);
}

/**
 *	Server IP Processing
 */

public void BuildIP()
{
	char sPort[8];
	char sPublicAddress[128];

	FindConVar("hostport").GetString(sPort, sizeof(sPort));
	FindConVar("net_public_adr").GetString(sPublicAddress, sizeof(sPublicAddress));

	if (!(strlen(sPublicAddress)))
	{
		FindConVar("ip").GetString(sPublicAddress, sizeof(sPublicAddress));

		int iIndex = FindCharInString(sPublicAddress, ':');

		if (iIndex == -1)
		{
			sPublicAddress[0] = '\0';
		}
		else
		{
			sPublicAddress[iIndex] = '\0';
		}
	}

	if (strlen(sPublicAddress) == 0)
	{
		int iIpVal = FindConVar("hostip").IntValue;
		int iIpVals[4];

		iIpVals[0] = (iIpVal >> 24) & 0x000000FF;
		iIpVals[1] = (iIpVal >> 16) & 0x000000FF;
		iIpVals[2] = (iIpVal >> 8) & 0x000000FF;
		iIpVals[3] = iIpVal & 0x000000FF;

		FormatEx(g_sServerIP, sizeof(g_sServerIP), "%d.%d.%d.%d:%s", iIpVals[0], iIpVals[1], iIpVals[2], iIpVals[3], sPort);
	}
	else
	{
		FormatEx(g_sServerIP, sizeof(g_sServerIP), "%s:%s", sPublicAddress, sPort);
	}
}

/**
 *	Reason File Management
 */

public void GenerateReasonFile()
{
	File fFile = OpenFile(g_sReasonsFile, "w", false, "GAME");

	if (!fFile)
	{
		SetFailState("Failed to open config file 'config/sourceadmin_reasons.cfg' for writing!");
	}

	fFile.WriteLine("// List of reasons seperated by a new line, max %d in length", 128);
	fFile.WriteLine("Advertising");
	fFile.WriteLine("Chat/Mic Spam");
	fFile.WriteLine("Disrespect");
	fFile.WriteLine("Hacking");
	fFile.WriteLine("Harrassment");
	fFile.WriteLine("Hate Speech/Racism");
	fFile.WriteLine("Impersonation");
	fFile.WriteLine("Inappropriate Name");

	fFile.Close();
}

public void ParseReasonsFile()
{
	File fFile = OpenFile(g_sReasonsFile, "r", false, "GAME");

	if (!fFile)
	{
		SetFailState("Failed to open config file 'config/sourceadmin_reasons.cfg' for reading!");
	}

	char sBuffer[128];

	while (!fFile.EndOfFile() && fFile.ReadLine(sBuffer, sizeof(sBuffer)))
	{
		if (!(sBuffer[0] == '/' || IsCharSpace(sBuffer[0])))
		{
			ReplaceString(sBuffer, sizeof(sBuffer), "\n", "", true);
			ReplaceString(sBuffer, sizeof(sBuffer), "\r", "", true);
			ReplaceString(sBuffer, sizeof(sBuffer), "	", "", true);

			int len = strlen(sBuffer);

			if (!(len < 3 || len > 128))
			{
				if (g_aReasons.FindString(sBuffer) == -1)
				{
					g_aReasons.PushString(sBuffer);
				}
			}
		}
	}

	fFile.Close();
}

/**
 *	Stock Functions
 */

stock bool IsValidClient(int iClient)
{
	return iClient > 0 && iClient <= MaxClients && IsClientConnected(iClient) && IsClientInGame(iClient);
}

stock void Colorize(char[] sMessage, int iSize)
{
	for (int i; i < sizeof(g_sColorNames); i++)
	{
		ReplaceString(sMessage, iSize, g_sColorNames[i], g_sColorCodes[i]);
	}
}

stock void StrToLower(const char[] sInput, char[] sOutput, int iSize)
{
	iSize--;

	int i;

	while (sInput[i] != '\0' && i < iSize)
	{
		sOutput[i] = CharToLower(sInput[i]);

		i++;
	}

	sOutput[i] = '\0';
}

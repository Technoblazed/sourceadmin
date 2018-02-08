#include <sourcemod>
#include <logdebug>
#include <ripext>
#include <sockets>

#pragma newdecls required
#pragma semicolon 1

ArrayList g_aCommandQueue;
ArrayList g_aReasons;

char g_sReasonsFile[256];
char g_sServerIP[16];

//ConVar g_cHostName;
ConVar g_cBroadcastNames;
ConVar g_cSocketAddress;
ConVar g_cSocketMaxRetries;
ConVar g_cSocketPassword;
ConVar g_cSocketPort;

int g_iRetries;

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

	//g_cHostName = FindConVar("hostname");

	g_cBroadcastNames = CreateConVar("sm_sourceadmin_broadcast_names", "1", "Should admin names be broadcasted when using the online chat system", _, true, 0.0, true, 1.0);
	g_cSocketAddress = CreateConVar("sm_sourceadmin_address", "localhost", "Address of the SourceAdmin server");
	g_cSocketMaxRetries = CreateConVar("sm_sourceadmin_max_retries", "30", "Maximum amount of times the server will attempt to reconnect to the socket server", _, true, 0.0);
	g_cSocketPassword = CreateConVar("sm_sourceadmin_password", "magicalbacon", "Password for the SourceAdmin server");
	g_cSocketPort = CreateConVar("sm_sourceadmin_port", "19857", "Port of the SourceAdmin server", _, true, 1.0);

	AutoExecConfig(true, "sourceadmin");

	RegConsoleCmd("call", Command_Report, "Open up the report player menu");
	RegConsoleCmd("report", Command_Report, "Open up the report player menu");

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

	ParseReasonsFile();
}

public void OnConfigsExecuted()
{
	if (g_sSocketStatus == eSocket_Disconnected)
	{
		ConnectToSocket();
	}
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

public int OnSocketConnected(Handle socket, any arg)
{
	g_iRetries = 0;
	g_sSocketStatus = eSocket_Connected;

	ProcessSocketOutbound();
}

public int OnSocketDisconnect(Handle socket, any arg)
{
	delete g_hSocketHandle;

	g_sSocketStatus = eSocket_Disconnected;

	CreateTimer(5.0, Timer_ProcessData);
}

public Action Timer_ProcessData(Handle timer)
{
	g_iRetries++;

	if (g_iRetries > g_cSocketMaxRetries.IntValue)
	{
		SetFailState("[SourceAdmin] Maximum connection retries reached. (%i/%i)", g_iRetries, g_cSocketMaxRetries.IntValue);
	}

	ProcessSocketOutbound();
}

public int OnSocketError(Handle socket, const int errorType, const int errorNum, any arg)
{
	delete g_hSocketHandle;

	g_sSocketStatus = eSocket_Closed;

	CreateTimer(5.0, Timer_ProcessData);
}

/**
 *	Socket Processing - Inbound
 */

public int OnSocketReceive(Handle socket, const char[] receiveData, const int dataSize, any arg)
{
	char sLocalPassword[64];
	char sPassword[64];
	char sType[32];

	g_cSocketPassword.GetString(sLocalPassword, sizeof(sLocalPassword));

	JSONObject jReceiveObject = JSONObject.FromString(receiveData);

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
			SendAuthRequest();
		}
		else if (StrEqual(sType, "chat"))
		{
			char sMessage[256];
			char sName[64];

			jReceiveObject.GetString("message", sMessage, sizeof(sMessage));
			jReceiveObject.GetString("name", sName, sizeof(sName));

			BroadcastAdminMessage(sName, sMessage);
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

public void PushRequest(char[] sBuffer, int size)
{
	ReplaceString(sBuffer, size, "\n", "", true);
	ReplaceString(sBuffer, size, "\r", "", true);
	ReplaceString(sBuffer, size, "\x09", "", true);

	StrCat(sBuffer, size, "\n");

	g_aCommandQueue.PushString(sBuffer);

	ProcessSocketOutbound();
}

public void SendAuthRequest()
{
	char sPassword[64];

	g_cSocketPassword.GetString(sPassword, sizeof(sPassword));

	JSONObject jAuthObject = new JSONObject();

	jAuthObject.SetString("type", "auth");
	jAuthObject.SetString("password", sPassword);

	char sRequest[512];

	jAuthObject.ToString(sRequest, sizeof(sRequest));

	delete jAuthObject;

	PushRequest(sRequest, sizeof(sRequest));
}

/**
 *	Command Processing
 */

public Action Command_Report(int client, int args)
{
	return Plugin_Handled;
}

/**
 *	Chat Processing
 */

public Action CommandListener_Say(int client, const char[] command, int argc)
{
	char sMessage[192];

	GetCmdArgString(sMessage, sizeof(sMessage));

	OnChatMessage(client, sMessage, 1);

	return Plugin_Continue;
}

public Action CommandListener_SayTeam(int client, const char[] command, int argc)
{
	char sMessage[192];

	GetCmdArgString(sMessage, sizeof(sMessage));

	OnChatMessage(client, sMessage, 2);

	return Plugin_Continue;
}

public void OnChatMessage(int client, char[] sMessage, int type)
{
	if (!IsValidClient(client))
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

	GetClientName(client, sName, sizeof(sName));
	GetClientAuthId(client, AuthId_SteamID64, sSteamID, sizeof(sSteamID));

	JSONObject jChatObject = new JSONObject();

	if (type == 1)
	{
		jChatObject.SetString("type", "chat");
	}
	else if (type == 2)
	{
		jChatObject.SetString("type", "chat_team");
	}

	jChatObject.SetString("message", sMessage);
	jChatObject.SetString("name", sName);
	jChatObject.SetString("steam", sSteamID);

	char sRequest[512];

	jChatObject.ToString(sRequest, sizeof(sRequest));

	delete jChatObject;

	PushRequest(sRequest, sizeof(sRequest));
}

public void BroadcastAdminMessage(const char[] sName, const char[] sMessage)
{
	char sPrefix[256];

	Format(sPrefix, sizeof(sPrefix), "%T", "BroadcastAdminMessage", LANG_SERVER, g_cBroadcastNames.BoolValue ? sName : "Admin");

	Colorize(sPrefix, sizeof(sPrefix));

	PrintToChatAll("%s %s", sPrefix, sMessage);
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

		int index = FindCharInString(sPublicAddress, ':');

		if (index == -1)
		{
			sPublicAddress[0] = '\0';
		}
		else
		{
			sPublicAddress[index] = '\0';
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
	File file = OpenFile(g_sReasonsFile, "w", false, "GAME");

	if (!file)
	{
		SetFailState("Failed to open config file 'config/sourceadmin_reasons.cfg' for writing!");
	}

	file.WriteLine("// List of reasons seperated by a new line, max %d in length", 128);
	file.WriteLine("Advertising");
	file.WriteLine("Chat/Mic Spam");
	file.WriteLine("Disrespect");
	file.WriteLine("Hacking");
	file.WriteLine("Harrassment");
	file.WriteLine("Hate Speech/Racism");
	file.WriteLine("Impersonation");
	file.WriteLine("Inappropriate Name");

	file.Close();
}

public void ParseReasonsFile()
{
	File file = OpenFile(g_sReasonsFile, "w", false, "GAME");

	if (!file)
	{
		SetFailState("Failed to open config file 'config/sourceadmin_reasons.cfg' for reading!");
	}

	char sBuffer[128];

	while (!file.EndOfFile() && file.ReadLine(sBuffer, sizeof(sBuffer)))
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

	file.Close();
}

/**
 *	Stock Functions
 */

stock bool IsValidClient(int client)
{
	return client > 0 && client <= MaxClients && IsClientConnected(client) && IsClientInGame(client);
}

stock void Colorize(char[] sMessage, int iSize)
{
	for (int i; i < sizeof(g_sColorNames); i++)
	{
		ReplaceString(sMessage, iSize, g_sColorNames[i], g_sColorCodes[i]);
	}
}

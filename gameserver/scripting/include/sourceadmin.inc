#if defined _sourceadmin_included_
#endinput
#endif
#define _sourceadmin_included_

native void SourceAdmin_PrintToChat(int iClient, const char[] sFormat, any:...);

public SharedPlugin __pl_sourceadmin = {
    name = "sourceadmin", file = "sourceadmin.smx",
#if defined REQUIRE_PLUGIN
    required = 1,
#else
    required = 0,
#endif
};

#if !defined REQUIRE_PLUGIN
public __pl_sourceadmin_SetNTVOptional() {
  MarkNativeAsOptional("SourceAdmin_PrintToChat");
}
#endif

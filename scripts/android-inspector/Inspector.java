package com.oriontv.danmaku.inspect;
import android.app.Instrumentation;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Xml;
import java.io.FileOutputStream;
import org.xmlpull.v1.XmlSerializer;

/** Separate test-only process. Never restarts or modifies the foreground application. */
public class Inspector extends Instrumentation {
  private String output;
  @Override public void onCreate(Bundle arguments) { super.onCreate(arguments);output=arguments.getString("output","/sdcard/window.xml");start(); }
  @Override public void onStart() {
    Bundle result=new Bundle();
    try {
      AccessibilityNodeInfo root=getUiAutomation().getRootInActiveWindow();
      if(root==null) throw new IllegalStateException("No accessibility root");
      FileOutputStream file=new FileOutputStream(output);
      XmlSerializer xml=Xml.newSerializer();xml.setOutput(file,"UTF-8");xml.startDocument("UTF-8",true);
      xml.startTag(null,"hierarchy");write(xml,root,0);xml.endTag(null,"hierarchy");xml.endDocument();file.close();root.recycle();
      result.putString("output",output);finish(Activity.RESULT_OK,result);
    }catch(Exception e){result.putString("error",e.getClass().getSimpleName());finish(Activity.RESULT_CANCELED,result);}
  }
  private void write(XmlSerializer xml,AccessibilityNodeInfo node,int depth)throws Exception {
    if(depth>60)return;
    xml.startTag(null,"node");
    xml.attribute(null,"text",node.getText()==null?"":node.getText().toString());
    xml.attribute(null,"content-desc",node.getContentDescription()==null?"":node.getContentDescription().toString());
    xml.attribute(null,"class",node.getClassName()==null?"":node.getClassName().toString());
    xml.attribute(null,"focused",Boolean.toString(node.isFocused()));
    Rect r=new Rect();node.getBoundsInScreen(r);xml.attribute(null,"bounds","["+r.left+","+r.top+"]["+r.right+","+r.bottom+"]");
    for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null){write(xml,child,depth+1);child.recycle();}}
    xml.endTag(null,"node");
  }
}

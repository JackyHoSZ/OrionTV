package com.oriontv.danmaku.inspect;
import android.app.Instrumentation;
import android.app.Activity;
import android.app.UiAutomation;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.os.Bundle;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Xml;
import java.io.StringWriter;
import org.xmlpull.v1.XmlSerializer;

/** Separate test-only process. Never restarts or modifies the foreground application. */
public class Inspector extends Instrumentation {
  private String keys;
  @Override public void onCreate(Bundle arguments) { super.onCreate(arguments);keys=arguments.getString("keys");start(); }
  @Override public void onStart() {
    Bundle result=new Bundle();
    try {
      UiAutomation automation=getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
      if(keys!=null){
        for(String value:keys.split(",")){
          int key=Integer.parseInt(value);long t=SystemClock.uptimeMillis();
          automation.injectInputEvent(new KeyEvent(t,t,KeyEvent.ACTION_DOWN,key,0),false);
          automation.injectInputEvent(new KeyEvent(t,t+50,KeyEvent.ACTION_UP,key,0),false);
          SystemClock.sleep(800);
        }
        result.putString("keys",keys);finish(Activity.RESULT_OK,result);return;
      }
      AccessibilityNodeInfo root=automation.getRootInActiveWindow();
      for(int i=0;i<20 && root==null;i++){Thread.sleep(100);root=automation.getRootInActiveWindow();}
      if(root==null) throw new IllegalStateException("No accessibility root");
      StringWriter file=new StringWriter();
      XmlSerializer xml=Xml.newSerializer();xml.setOutput(file);xml.startDocument("UTF-8",true);
      xml.startTag(null,"hierarchy");write(xml,root,0);xml.endTag(null,"hierarchy");xml.endDocument();root.recycle();
      result.putString("xml",file.toString());finish(Activity.RESULT_OK,result);
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
